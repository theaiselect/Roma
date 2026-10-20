import { describe, expect, it } from 'vitest';
import { backupReminder, BACKUP_EVERY_MS } from '@/lib/backup-reminder';
import { openReservations } from '@/lib/reservations';
import { rainSuggested } from '@/lib/weather';
import { phraseGroups } from '@/data/phrases';
import { daysUntil, romeToUtc } from '@/lib/time';
import type { Reservation, ReservationStatus } from '@/data/types';

const R = (id: string, status: ReservationStatus, day?: Reservation['day']): Reservation => ({ id, title: id, status, day });

describe('openReservations', () => {
  const now = romeToUtc('2026-10-29', '12:00');
  const st = (r: Reservation) => r.status;
  it('solo lo que falta por hacer, lo más urgente primero y lo sin fecha al final', () => {
    const list = [R('sin-fecha', 'todo'), R('lunes', 'todo', 4), R('sabado', 'pending', 2), R('hecho', 'bought', 2), R('agotada', 'soldout', 3)];
    expect(openReservations(list, st, now, daysUntil).map((o) => o.r.id)).toEqual(['sabado', 'lunes', 'sin-fecha']);
  });
  it('no avisa de lo que ya pasó', () => {
    const later = romeToUtc('2026-11-01', '09:00');
    expect(openReservations([R('viernes', 'todo', 1), R('lunes', 'todo', 4)], st, later, daysUntil).map((o) => o.r.id)).toEqual(['lunes']);
  });
  it('respeta el estado cambiado desde la app', () => {
    expect(openReservations([R('a', 'todo', 2)], () => 'bought', now, daysUntil)).toEqual([]);
  });
});

describe('backupReminder', () => {
  const start = romeToUtc('2026-10-30', '00:00');
  const ret = romeToUtc('2026-11-03', '00:00');
  const base = { items: 5, returnAt: ret, tripStartAt: start };
  it('no avisa antes del viaje ni si no hay nada que perder', () => {
    expect(backupReminder({ ...base, now: start - 1000, lastAt: null })).toBeNull();
    expect(backupReminder({ ...base, items: 0, now: start + 5 * 24 * 3600_000, lastAt: null })).toBeNull();
  });
  it('avisa si nunca se ha guardado una copia', () => {
    const r = backupReminder({ ...base, now: start + 3600_000, lastAt: null });
    expect(r?.urgent).toBe(false);
    expect(r?.text).toMatch(/Todavía no/);
  });
  it('no avisa si la copia es reciente y sí cuando pasan más de 3 días', () => {
    const now = start + 2 * 24 * 3600_000;
    expect(backupReminder({ ...base, now, lastAt: now - 3600_000 })).toBeNull();
    expect(backupReminder({ ...base, now, lastAt: now - BACKUP_EVERY_MS - 1 })?.urgent).toBe(false);
  });
  it('el día de la vuelta el aviso es urgente', () => {
    expect(backupReminder({ ...base, now: ret + 3600_000, lastAt: null })?.urgent).toBe(true);
  });
});

describe('rainSuggested', () => {
  it('propone el plan solo con lluvia prevista, plan disponible y sin activar', () => {
    expect(rainSuggested({ code: 63, rainProb: 80 }, true, false)).toBe(true);
    expect(rainSuggested({ code: 61, rainProb: null }, true, false)).toBe(true);
    expect(rainSuggested({ code: 1, rainProb: 20 }, true, false)).toBe(false);
    expect(rainSuggested({ code: 63, rainProb: 80 }, false, false)).toBe(false);
    expect(rainSuggested({ code: 63, rainProb: 80 }, true, true)).toBe(false);
    expect(rainSuggested(undefined, true, false)).toBe(false);
  });
});

describe('frases', () => {
  it('hay grupo de hotel y taxi y no hay frases repetidas dentro de un mismo grupo', () => {
    expect(phraseGroups.some((g) => g.id === 'hotel')).toBe(true);
    for (const g of phraseGroups) expect(new Set(g.items.map((p) => p.it)).size).toBe(g.items.length);
  });
});
