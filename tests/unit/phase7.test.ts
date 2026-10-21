import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { KINDS, validate } from '../../api/_core';
import { distinctRoutes, parseOsrmAll, type Route } from '@/lib/osm';
import { distToSegmentsM, metroQuery, nearestStation, parseMetro, metroText } from '@/lib/metro-map';
import { gridElevation, gridShape, profileFrom, sampleRoute, type ReliefGrid } from '@/lib/relief';
import { findSaved, savedId, toggleSaved, type SavedEntity } from '@/lib/saved';
import { fold, pickWiki, wikiPlaces, WIKI_HINT, wikiUrl, articleUrl } from '@/lib/wiki';
import { listKind } from '@/lib/db';
import { distanceM } from '@/lib/geo';
import { places } from '@/data/places';

// Lo mínimo de window y localStorage para que db.ts funcione en Node (igual que db.test.ts).
const target = new EventTarget();
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) }),
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
});

describe('sitios guardados', () => {
  it('el servidor acepta el tipo «saved»', () => {
    expect(KINDS.has('saved')).toBe(true);
    const e = validate({ id: 'saved:colosseo', kind: 'saved', updatedAt: 1, deviceId: 'd', author: 'lucia', name: 'Coliseo', lat: 41.89, lng: 12.49 });
    expect(e?.id).toBe('saved:colosseo');
  });
  it('id estable: por sitio del plan o por coordenadas', () => {
    expect(savedId({ placeId: 'trevi', lat: 1, lng: 2 })).toBe('saved:trevi');
    expect(savedId({ lat: 41.900123, lng: 12.480987 })).toBe('saved:41.9001,12.4810');
  });
  it('guardar, encontrar y quitar la estrella', async () => {
    expect(await toggleSaved([], { name: 'Fontana', lat: 41.9008, lng: 12.4831, placeId: 'trevi' })).toBe(true);
    const list = (await listKind('saved')) as SavedEntity[];
    expect(list).toHaveLength(1);
    expect(findSaved(list, { placeId: 'trevi', lat: 0, lng: 0 })?.name).toBe('Fontana');
    expect(await toggleSaved(list, { name: 'Fontana', lat: 41.9008, lng: 12.4831, placeId: 'trevi' })).toBe(false);
    expect(await listKind('saved')).toHaveLength(0);
    expect(await toggleSaved([], { name: 'Fontana', lat: 41.9008, lng: 12.4831, placeId: 'trevi' })).toBe(true); // se puede volver a guardar
    expect(await listKind('saved')).toHaveLength(1);
  });
  it('un punto libre se reconoce a menos de 15 m', () => {
    const s = { id: 'saved:41.9000,12.4800', kind: 'saved', name: 'x', lat: 41.9, lng: 12.48 } as SavedEntity;
    expect(findSaved([s], { lat: 41.90005, lng: 12.48005 })).toBe(s);
    expect(findSaved([s], { lat: 41.9005, lng: 12.4805 })).toBeUndefined();
  });
});

describe('rutas alternativas', () => {
  const osrm = (d: number, t: number) => ({ distance: d, duration: t, geometry: { coordinates: [[12.49, 41.9], [12.5, 41.91]] as [number, number][] }, legs: [] });
  it('lee todas las rutas de OSRM', () => {
    const rs = parseOsrmAll({ code: 'Ok', routes: [osrm(1000, 700), osrm(1200, 800)] });
    expect(rs.map((r) => r.distanceM)).toEqual([1000, 1200]);
    expect(parseOsrmAll({ code: 'NoRoute' })).toEqual([]);
    expect(parseOsrmAll(null)).toEqual([]);
  });
  it('quita las casi idénticas y limita a 3', () => {
    const r = (d: number, t: number): Route => ({ distanceM: d, durationS: t, coords: [], steps: [], legs: [] });
    expect(distinctRoutes([r(1000, 700), r(1010, 705), r(1300, 900), r(1600, 1100), r(2000, 1500)]).map((x) => x.distanceM)).toEqual([1000, 1300, 1600]);
  });
});

describe('relieve y desnivel', () => {
  const grid = (f: (y: number, x: number) => number): ReliefGrid => {
    const rows = 4, cols = 4;
    const h: number[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) h.push(f(y, x));
    return { at: 1, south: 41.9, west: 12.4, dLat: 0.01, dLng: 0.01, rows, cols, h };
  };
  it('interpola entre celdas y devuelve null fuera de la malla', () => {
    const g = grid((_y, x) => x * 10); // sube 10 m por celda hacia el este
    expect(gridElevation(g, 41.91, 12.415)).toBeCloseTo(15, 5);
    expect(gridElevation(g, 41.9, 12.4)).toBeCloseTo(0, 5);
    expect(gridElevation(g, 41.9, 12.43)).toBeCloseTo(30, 5);
    expect(gridElevation(g, 41.8, 12.4)).toBeNull();
    expect(gridElevation(g, 41.91, 12.5)).toBeNull();
  });
  it('la malla de Roma tiene un tamaño razonable (≈3000 puntos, ~30 peticiones)', () => {
    const { rows, cols } = gridShape();
    expect(rows * cols).toBeGreaterThan(2000);
    expect(rows * cols).toBeLessThan(4000);
  });
  it('muestrea la ruta cada 25 m y conserva el final', () => {
    const a = { lat: 41.9, lng: 12.5 };
    const b = { lat: 41.9, lng: 12.5 + 500 / (111_320 * Math.cos((41.9 * Math.PI) / 180)) };
    const pts = sampleRoute([[a.lng, a.lat], [b.lng, b.lat]], 25);
    expect(pts.length).toBe(21);
    expect(distanceM(pts[0]!, a)).toBeLessThan(1);
    expect(distanceM(pts[pts.length - 1]!, b)).toBeLessThan(1);
    expect(sampleRoute([], 25)).toEqual([]);
  });
  it('suma subidas y bajadas sin contar ruido', () => {
    const up = Array.from({ length: 21 }, (_, i) => 10 + i); // sube 20 m
    const p = profileFrom(up, 500);
    expect(p.ascent).toBeGreaterThanOrEqual(17);
    expect(p.ascent).toBeLessThanOrEqual(21);
    expect(p.descent).toBe(0);
    const flat = profileFrom(Array.from({ length: 30 }, (_, i) => 20 + (i % 2) * 0.4), 700);
    expect(flat.ascent + flat.descent).toBe(0);
    const hill = profileFrom([10, 20, 30, 20, 10], 100);
    expect(hill.ascent).toBeGreaterThan(5);
    expect(hill.descent).toBeGreaterThan(5);
    expect(hill.pts.length).toBeGreaterThan(1);
  });
});

describe('metro', () => {
  const way = (id: number, lat0: number) => ({ type: 'way', ref: id, role: '', geometry: [{ lat: lat0, lon: 12.48 }, { lat: lat0, lon: 12.5 }, { lat: lat0, lon: 12.52 }] });
  const sample: Parameters<typeof parseMetro>[0] = {
    elements: [
      { type: 'relation', id: 1, tags: { route: 'subway', ref: 'A' }, members: [way(10, 41.9), way(11, 41.91)] },
      { type: 'relation', id: 2, tags: { route: 'subway', ref: 'A' }, members: [way(10, 41.9), way(11, 41.91)] }, // otro sentido: mismas vías
      { type: 'relation', id: 3, tags: { route: 'subway', ref: 'B' }, members: [way(20, 41.95)] },
      { type: 'node', id: 5, lat: 41.9003, lon: 12.5, tags: { name: 'Barberini', railway: 'station' } },
      { type: 'node', id: 6, lat: 41.9003, lon: 12.5001, tags: { name: 'Barberini', railway: 'station' } }, // duplicada
      { type: 'node', id: 7, lat: 41.95, lon: 12.5, tags: { name: 'Lejos', railway: 'station' } },
      { type: 'node', id: 8, lat: 41.8, lon: 12.5, tags: { railway: 'station' } }, // sin nombre
      { type: 'way', id: 9, center: { lat: 41.9101, lon: 12.51 }, tags: { name: 'Edificio', railway: 'station' } }, // estación dibujada como edificio
    ],
  };
  it('lee líneas (sin repetir vías) y estaciones con sus líneas', () => {
    const m = parseMetro(sample, 7)!;
    expect(m.lines.map((l) => l.ref)).toEqual(['A', 'B']);
    expect(m.lines[0]!.segments).toHaveLength(2);
    expect(m.lines[0]!.color).toBe('#E87722');
    expect(m.stations.map((s) => s.n)).toEqual(['Barberini', 'Lejos', 'Edificio']);
    expect(m.stations[0]!.lines).toEqual(['A']);
    expect(m.stations[1]!.lines).toEqual(['B']);
  });
  it('vías que salen de la zona (puntos a null con «out geom(bbox)») se parten sin romperse', () => {
    const g = (lat: number) => ({ lat, lon: 12.5 });
    const m = parseMetro({ elements: [
      { type: 'relation', id: 1, tags: { ref: 'C' }, members: [{ type: 'way', ref: 30, geometry: [g(41.90), g(41.901), null, null, g(41.903), g(41.904), g(41.905), null, g(41.907)] }] },
      { type: 'node', id: 2, lat: 41.9, lon: 12.5, tags: { name: 'San Giovanni', railway: 'station' } },
    ] })!;
    expect(m.lines[0]!.segments).toEqual([[[12.5, 41.9], [12.5, 41.901]], [[12.5, 41.903], [12.5, 41.904], [12.5, 41.905]]]);
  });
  it('sin datos útiles devuelve null', () => { expect(parseMetro({ elements: [] })).toBeNull(); expect(parseMetro(null)).toBeNull(); });
  it('estación más cercana y texto', () => {
    const m = parseMetro(sample)!;
    const n = nearestStation(m.stations, { lat: 41.9, lng: 12.5 })!;
    expect(n.s.n).toBe('Barberini');
    const t = metroText({ s: n.s, d: 300 });
    expect(t.meters).toBe(390);
    expect(t.minutes).toBe(5);
  });
  it('distancia a una línea', () => {
    expect(distToSegmentsM({ lat: 41.9, lng: 12.5 }, [[[12.48, 41.9], [12.52, 41.9]]])).toBeLessThan(1);
    expect(distToSegmentsM({ lat: 41.9009, lng: 12.5 }, [[[12.48, 41.9], [12.52, 41.9]]])).toBeGreaterThan(90);
  });
  it('la consulta pide líneas de metro y estaciones de la zona', () => {
    const q = metroQuery();
    expect(q).toContain('route"="subway');
    expect(q).toContain('out geom(');
  });
});

describe('fotos de los sitios (Wikipedia)', () => {
  const page = (title: string, index: number) => ({ title, index, extract: 'x' });
  it('elige el artículo que encaja con el sitio, no el más cercano a secas', () => {
    const pages = [page('Via dei Fori Imperiali', 1), page('Coliseo', 2), page('Arco de Constantino', 3)];
    expect(pickWiki(pages, WIKI_HINT.colosseo!)?.title).toBe('Coliseo');
    expect(pickWiki(pages, WIKI_HINT.trevi!)).toBeNull();
  });
  it('ignora tildes y mayúsculas, y prefiere el más cercano', () => {
    expect(fold('Panteón de Agripa')).toBe('panteon de agripa');
    const pages = [page('Panteón de Agripa', 5), page('Panteón (Roma)', 2)];
    expect(pickWiki(pages, WIKI_HINT.pantheon!)?.title).toBe('Panteón (Roma)');
  });
  it('cada pista tiene sitio en el plan con coordenadas', () => {
    const ids = new Set(wikiPlaces().map((p) => p.id));
    for (const id of Object.keys(WIKI_HINT)) expect(places.find((p) => p.id === id), id).toBeDefined();
    expect(ids.size).toBeGreaterThan(20);
  });
  it('URLs bien formadas', () => {
    expect(wikiUrl(41.89, 12.49)).toContain('ggscoord=41.89%7C12.49');
    expect(wikiUrl(41.89, 12.49)).toContain('origin=*');
    // Wikipedia da como mucho 20 resúmenes por petición: pedir más artículos deja alguno sin texto.
    const u = new URL(wikiUrl(41.89, 12.49));
    expect(Number(u.searchParams.get('exlimit'))).toBeLessThanOrEqual(20);
    expect(Number(u.searchParams.get('ggslimit'))).toBeLessThanOrEqual(Number(u.searchParams.get('exlimit')));
    expect(articleUrl('Plaza de España (Roma)')).toBe('https://es.wikipedia.org/wiki/Plaza_de_Espa%C3%B1a_(Roma)');
  });
});

describe('pistas de Wikipedia afinadas', () => {
  it('no confunde un sitio con el artículo de al lado', () => {
    expect(WIKI_HINT.campidoglio!.test(fold('Loba capitolina'))).toBe(false);
    expect(WIKI_HINT.campidoglio!.test(fold('Plaza del Campidoglio'))).toBe(true);
    expect(WIKI_HINT.trevi!.test(fold('Trevi (rione)'))).toBe(false);
    expect(WIKI_HINT.trevi!.test(fold('Fontana de Trevi'))).toBe(true);
    expect(WIKI_HINT.colosseo!.test(fold('Colosseo (metro de Roma)'))).toBe(false);
    expect(WIKI_HINT.termini!.test(fold('Termini (Sicilia)'))).toBe(false);
    // Títulos reales de es.wikipedia junto a esos sitios (comprobado el 21 oct 2026)
    expect(WIKI_HINT.campidoglio!.test(fold('Colina Capitolina'))).toBe(true);
    expect(WIKI_HINT.ghetto!.test(fold('Pórtico de Octavia'))).toBe(true);
    expect(WIKI_HINT.ghetto!.test(fold('Teatro de Marcelo'))).toBe(false);
  });
});
