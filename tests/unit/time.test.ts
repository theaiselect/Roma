import { describe, expect, it } from 'vitest';
import { daysUntil, now, romeParts, romeToUtc } from '@/lib/time';

describe('hora de Roma', () => {
  it('antes del 25 oct está en horario de verano (UTC+2)', () => {
    expect(romeToUtc('2026-10-24', '12:00')).toBe(Date.UTC(2026, 9, 24, 10, 0));
  });

  it('desde el 25 oct está en horario de invierno (UTC+1)', () => {
    expect(romeToUtc('2026-10-31', '13:00')).toBe(Date.UTC(2026, 9, 31, 12, 0));
    expect(romeToUtc('2026-11-03', '05:00')).toBe(Date.UTC(2026, 10, 3, 4, 0));
  });

  it('romeParts devuelve fecha, hora y día de la semana de Roma', () => {
    const p = romeParts(Date.UTC(2026, 10, 1, 23, 30)); // 00:30 del lunes 2 en Roma
    expect(p.date).toBe('2026-11-02');
    expect(p.time).toBe('00:30');
    expect(p.weekday).toBe('mon');
  });
});

describe('?now=', () => {
  it('interpreta el parámetro como hora de Roma', () => {
    expect(now('?now=2026-10-31T13:00', 0)).toBe(Date.UTC(2026, 9, 31, 12, 0));
  });
  it('ignora valores no válidos y usa la hora real', () => {
    expect(now('?now=mañana', 123)).toBe(123);
    expect(now('', 456)).toBe(456);
  });
});

describe('cuenta atrás', () => {
  it('cuenta días de calendario en Roma', () => {
    const t = romeToUtc('2026-10-19', '01:30');
    expect(daysUntil(t, '2026-10-30')).toBe(11);
    expect(daysUntil(romeToUtc('2026-10-30', '23:59'), '2026-10-30')).toBe(0);
  });
});
