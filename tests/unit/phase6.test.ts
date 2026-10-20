import { describe, expect, it } from 'vitest';
import { stagesNeeded, MAP_MAX_AGE, DATA_MAX_AGE } from '@/lib/auto-offline';
import { arrivalLine, arrivedAt, ARRIVAL_LINES, type MapStop } from '@/lib/map-stops';
import { distanceM } from '@/lib/geo';
import type { OfflineStatus } from '@/lib/offline-data';

const NOW = 1_800_000_000_000;
const full = (over: Partial<OfflineStatus> = {}): OfflineStatus => ({
  map: { at: NOW - 1000, tiles: 10, bytes: 1 }, graph: { at: NOW - 1000, nodes: 1, streets: 1 }, places: { at: NOW - 1000, count: 1 }, pois: { at: NOW - 1000, count: 1 },
  weather: NOW, blobs: { total: 3, missing: 0 }, ...over,
});

describe('stagesNeeded (descarga automática)', () => {
  it('no hace nada si todo está guardado y reciente', () => expect(stagesNeeded(full(), NOW)).toEqual([]));
  it('descarga lo que falta', () => {
    expect(stagesNeeded(full({ map: undefined, graph: undefined }), NOW)).toEqual(['map', 'graph']);
    expect(stagesNeeded({ ...full(), map: undefined, graph: undefined, places: undefined, pois: undefined, blobs: { total: 2, missing: 2 } }, NOW)).toEqual(['map', 'graph', 'places', 'pois', 'files']);
  });
  it('renueva lo viejo: el mapa a los 30 días y los datos a las 2 semanas', () => {
    expect(stagesNeeded(full({ map: { at: NOW - MAP_MAX_AGE - 1, tiles: 1, bytes: 1 } }), NOW)).toEqual(['map']);
    expect(stagesNeeded(full({ graph: { at: NOW - DATA_MAX_AGE - 1, nodes: 1, streets: 1 } }), NOW)).toEqual(['graph']);
    expect(stagesNeeded(full({ map: { at: NOW - DATA_MAX_AGE - 1, tiles: 1, bytes: 1 } }), NOW)).toEqual([]);
  });
  it('baja solo los archivos que faltan', () => expect(stagesNeeded(full({ blobs: { total: 5, missing: 1 } }), NOW)).toEqual(['files']));
});

describe('arrivedAt (momento «habéis llegado»)', () => {
  const stop = (placeId: string, n: number, lat: number, lng: number): MapStop => ({ placeId, n, lat, lng, title: placeId, visits: [], status: 'todo' });
  const stops = [stop('a', 1, 41.9, 12.49), stop('b', 2, 41.9005, 12.49)];
  it('detecta la parada más cercana a menos de 45 m', () => {
    expect(arrivedAt({ lat: 41.90001, lng: 12.49 }, stops, new Set(), distanceM)?.placeId).toBe('a');
  });
  it('no avisa de lejos ni de una parada ya saludada', () => {
    expect(arrivedAt({ lat: 41.91, lng: 12.49 }, stops, new Set(), distanceM)).toBeUndefined();
    expect(arrivedAt({ lat: 41.90001, lng: 12.49 }, stops, new Set(['a']), distanceM)).toBeUndefined();
  });
  it('cada parada tiene su frase y se reparten en ciclo', () => {
    expect(arrivalLine(1)).toBe(ARRIVAL_LINES[0]);
    expect(arrivalLine(ARRIVAL_LINES.length + 1)).toBe(ARRIVAL_LINES[0]);
    expect(new Set(ARRIVAL_LINES).size).toBe(ARRIVAL_LINES.length);
  });
});
