import { describe, expect, it } from 'vitest';
import { buildGraph, routeLeg, snap, type RawWay } from '@/lib/graph';
import { nearestItem, parsePlaces, parseWays, searchItems, splitBbox, streetItems } from '@/lib/offline-data';
import { climateNormals } from '@/lib/weather';

// Ciudad de juguete: 6 calles E-O y 6 N-S, cada 0,001° (≈ 85–111 m).
const LAT0 = 41.9, LNG0 = 12.49, S = 0.001;
function city(): RawWay[] {
  const w: RawWay[] = [];
  for (let i = 0; i < 6; i++) {
    w.push({ hw: 'residential', name: `Via Este ${i}`, pts: Array.from({ length: 6 }, (_, j) => [LAT0 + i * S, LNG0 + j * S] as [number, number]) });
    w.push({ hw: 'footway', name: `Via Norte ${i}`, pts: Array.from({ length: 6 }, (_, j) => [LAT0 + j * S, LNG0 + i * S] as [number, number]) });
  }
  return w;
}
const at = (i: number, j: number) => ({ lat: LAT0 + i * S, lng: LNG0 + j * S });

describe('grafo de calles', () => {
  const g = buildGraph(city());
  it('une los cruces y guarda nombres', () => {
    expect(g.n).toBe(36);
    expect(g.names.length).toBe(12);
  });
  it('ajusta un punto a la calle más cercana', () => {
    const s = snap(g, { lat: LAT0 + 0.0002, lng: LNG0 + 0.0021 });
    expect(s).not.toBeNull();
    expect(s!.off).toBeLessThan(30);
  });
  it('no ajusta un punto lejos de toda calle', () => {
    expect(snap(g, { lat: 45, lng: 9 })).toBeNull();
  });
  it('calcula la ruta más corta (Manhattan) con salida y llegada', () => {
    const r = routeLeg(g, at(0, 0), at(3, 4))!;
    expect(r).not.toBeNull();
    const straight = 3 * 111.2 + 4 * 82.7;
    expect(r.distanceM).toBeGreaterThan(straight - 15);
    expect(r.distanceM).toBeLessThan(straight + 15);
    expect(r.steps[0]!.type).toBe('depart');
    expect(r.steps.at(-1)!.type).toBe('arrive');
    expect(Math.abs(r.durationS - r.distanceM / 1.3)).toBeLessThan(1);
  });
  it('da un giro cuando cambia de calle', () => {
    const r = routeLeg(g, at(0, 0), at(3, 4))!;
    const turns = r.steps.filter((s) => s.type === 'turn');
    expect(turns.length).toBeGreaterThanOrEqual(1);
    expect(r.steps.map((s) => s.distanceM).reduce((a, b) => a + b, 0)).toBeGreaterThan(r.distanceM - 5);
  });
  it('gira a la derecha al ir al este y luego al sur', () => {
    const r = routeLeg(g, at(5, 0), at(2, 0))!; // sur recto: sin giros
    expect(r.steps.filter((s) => s.type === 'turn')).toHaveLength(0);
    const r2 = routeLeg(g, at(5, 0), at(5, 3))!; // este recto
    expect(r2.steps.filter((s) => s.type === 'turn')).toHaveLength(0);
  });
  it('misma calle: ruta directa', () => {
    const r = routeLeg(g, { lat: LAT0, lng: LNG0 + 0.0002 }, { lat: LAT0, lng: LNG0 + 0.0006 })!;
    expect(r.distanceM).toBeLessThan(60);
    expect(r.steps).toHaveLength(2);
  });
  it('null si no hay calles cerca', () => {
    expect(routeLeg(g, at(0, 0), { lat: 45, lng: 9 })).toBeNull();
  });
  it('evita escaleras si hay rodeo corto', () => {
    const ways = city();
    ways.push({ hw: 'steps', pts: [[LAT0, LNG0], [LAT0 + 0.0012, LNG0 + 0.0002], [LAT0 + S, LNG0 + S]] });
    const g2 = buildGraph(ways);
    const r = routeLeg(g2, at(0, 0), at(1, 1))!;
    expect(r.distanceM).toBeGreaterThan(185); // por las calles (~194 m), no por las escaleras (~216 m × 1,35)
    expect(r.distanceM).toBeLessThan(205);
  });
});

describe('buscador sin conexión', () => {
  const items = parsePlaces({ elements: [
    { type: 'node', lat: 41.8986, lon: 12.4769, tags: { name: 'Pantheon', historic: 'monument' } },
    { type: 'node', lat: 41.9009, lon: 12.4833, tags: { name: 'Fontana di Trevi', amenity: 'fountain' } },
    { type: 'way', center: { lat: 41.9, lon: 12.47 }, tags: { name: 'Caffè Sant’Eustachio', amenity: 'cafe' } },
    { type: 'node', lat: 41.9, lon: 12.47, tags: { name: 'Caffè Sant’Eustachio', amenity: 'cafe' } },
    { type: 'node', lat: 41.9, lon: 12.47, tags: { amenity: 'cafe' } },
  ] });
  it('descarta duplicados y elementos sin nombre', () => expect(items).toHaveLength(3));
  it('encuentra sin tildes ni mayúsculas', () => {
    expect(searchItems(items, 'caffe sant eustachio')[0]!.name).toBe('Caffè Sant’Eustachio');
    expect(searchItems(items, 'PANTHEON')[0]!.detail).toBe('Monumento');
    expect(searchItems(items, 'trevi')[0]!.name).toBe('Fontana di Trevi');
  });
  it('nada si no coincide', () => expect(searchItems(items, 'zzzz')).toEqual([]));
  it('busca calles del grafo', () => {
    const streets = streetItems(buildGraph(city()));
    expect(searchItems(streets, 'via norte 3')[0]!.detail).toBe('Calle');
  });
  it('sitio más cercano a un punto', () => {
    expect(nearestItem(items, { lat: 41.89862, lng: 12.47692 }, 40)!.n).toBe('Pantheon');
    expect(nearestItem(items, { lat: 41.95, lng: 12.5 }, 40)).toBeNull();
  });
});

describe('descarga', () => {
  it('parte un rectángulo en trozos que lo cubren', () => {
    const parts = splitBbox({ west: 0, south: 0, east: 3, north: 2 }, 3, 2);
    expect(parts).toHaveLength(6);
    expect(Math.min(...parts.map((p) => p.west))).toBe(0);
    expect(Math.max(...parts.map((p) => p.north))).toBe(2);
  });
  it('lee caminos de Overpass', () => {
    const ways = parseWays({ elements: [
      { type: 'way', tags: { highway: 'footway', name: 'X' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] },
      { type: 'way', tags: { building: 'yes' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] },
      { type: 'node' },
    ] });
    expect(ways).toHaveLength(1);
    expect(ways[0]!.pts[1]).toEqual([1.1, 2.1]);
  });
  it('tiempo típico cuando no hay previsión', () => {
    const f = climateNormals(['2026-10-30', '2026-10-31']);
    expect(f.normals).toBe(true);
    expect(f.days).toHaveLength(2);
  });
});

import { closedToday } from '@/screens/today-extras';
import { romeToUtc } from '@/lib/time';
describe('cerrados hoy', () => {
  it('el domingo cierra Da Enzo; el lunes no', () => {
    expect(closedToday(romeToUtc('2026-11-01', '11:00'))).toContain('Da Enzo al 29');
    expect(closedToday(romeToUtc('2026-11-02', '11:00'))).not.toContain('Da Enzo al 29');
  });
});
