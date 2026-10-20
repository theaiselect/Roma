import { describe, expect, it } from 'vitest';
import { buildDayStops, shortTitle, upcoming } from '@/lib/map-stops';
import { timeline } from '@/lib/schedule';
import { romeToUtc } from '@/lib/time';
import type { Stop } from '@/data/types';

const S = (id: string, start: string, placeId?: string, day: Stop['day'] = 2): Stop => ({ id, day, start, placeId, title: `T-${id}` });
const coords: Record<string, { lat: number; lng: number }> = { a: { lat: 1, lng: 1 }, b: { lat: 2, lng: 2 }, c: { lat: 3, lng: 3 } };
const resolve = (id: string) => coords[id];
const base = { done: new Set<string>(), resolve };

describe('buildDayStops', () => {
  const tl = timeline([S('s1', '08:00', 'a'), S('s2', '09:00', 'b'), S('s3', '10:00', undefined), S('s4', '11:00', 'a'), S('s5', '12:00', 'c'), S('x', '09:00', 'a', 3)]);
  it('numera por orden y salta paradas sin sitio o sin coordenadas', () => {
    const r = buildDayStops(tl, 2, { ...base, now: 0 });
    expect(r.stops.map((s) => [s.placeId, s.n])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    expect(buildDayStops(tl, 2, { ...base, now: 0, resolve: (id) => (id === 'a' ? coords.a : undefined) }).stops.map((s) => s.n)).toEqual([1]);
  });
  it('un sitio visitado dos veces tiene un solo número y las dos visitas', () => {
    const r = buildDayStops(tl, 2, { ...base, now: 0 });
    expect(r.stops[0]!.visits.map((v) => v.id)).toEqual(['s1', 's4']);
    expect(r.path.map((s) => s.n)).toEqual([1, 2, 1, 3]);
  });
  it('no repite el mismo sitio dos veces seguidas en el recorrido', () => {
    const t = timeline([S('p', '08:00', 'a'), S('q', '09:00', 'a'), S('r', '10:00', 'b')]);
    expect(buildDayStops(t, 2, { ...base, now: 0 }).path.map((s) => s.n)).toEqual([1, 2]);
  });
  it('solo cuenta el día pedido', () => {
    expect(buildDayStops(tl, 3, { ...base, now: 0 }).stops.map((s) => s.placeId)).toEqual(['a']);
  });
  it('estados: hecha, en curso, siguiente y pendiente', () => {
    const now = romeToUtc('2026-10-31', '09:30');
    const r = buildDayStops(tl, 2, { ...base, now, currentId: 's2', nextId: 's4' });
    expect(r.stops.map((s) => s.status)).toEqual(['next', 'now', 'todo']);
    expect(upcoming(r.stops)?.placeId).toBe('b');
  });
  it('lo ya pasado sale como hecho y lo marcado en el Plan también', () => {
    const now = romeToUtc('2026-10-31', '13:00');
    expect(buildDayStops(tl, 2, { ...base, now }).stops.map((s) => s.status)).toEqual(['done', 'done', 'done']);
    const future = romeToUtc('2026-10-30', '08:00');
    expect(buildDayStops(tl, 2, { ...base, now: future, done: new Set(['s2']) }).stops.map((s) => s.status)).toEqual(['todo', 'done', 'todo']);
  });
});

describe('shortTitle', () => {
  it('quita paréntesis y recorta', () => {
    expect(shortTitle('Coliseo (Full Experience)')).toBe('Coliseo');
    expect(shortTitle('Museos Vaticanos + Capilla Sixtina y mucho más', 20)).toBe('Museos Vaticanos +…');
  });
});
