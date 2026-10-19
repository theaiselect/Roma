import { TIME_ZONE } from '@/data/trip';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  weekday: 'short', hourCycle: 'h23',
});

export interface RomeParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  y: number; m: number; d: number; h: number; mi: number; s: number;
}

const WD: Record<string, RomeParts['weekday']> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

/** Fecha y hora de pared en Roma para un instante. */
export function romeParts(ms: number): RomeParts {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  const y = Number(p.year), m = Number(p.month), d = Number(p.day);
  const h = Number(p.hour), mi = Number(p.minute), s = Number(p.second);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    y, m, d, h, mi, s,
    date: `${y}-${pad(m)}-${pad(d)}`,
    time: `${pad(h)}:${pad(mi)}`,
    weekday: WD[p.weekday ?? ''] ?? 'mon',
  };
}

/** Desfase de Roma respecto a UTC (ms) en un instante dado. */
export function romeOffsetMs(ms: number): number {
  const r = romeParts(ms);
  const asUtc = Date.UTC(r.y, r.m - 1, r.d, r.h, r.mi, r.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convierte una hora de pared de Roma ('YYYY-MM-DD', 'HH:mm') a instante UTC (ms). */
export function romeToUtc(date: string, time = '00:00'): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - romeOffsetMs(guess);
  // Segunda pasada por si el primer desfase cae al otro lado de un cambio de hora.
  utc = guess - romeOffsetMs(utc);
  return utc;
}

const NOW_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * Instante «ahora». Con ?now=2026-10-31T13:00 (hora de Roma) simula cualquier
 * momento del viaje; si el parámetro no es válido se ignora.
 */
export function now(search: string = typeof location !== 'undefined' ? location.search : '', real: number = Date.now()): number {
  const v = new URLSearchParams(search).get('now');
  const m = v ? NOW_RE.exec(v) : null;
  if (!m) return real;
  return romeToUtc(m[1]!, m[2]!);
}

/** Días de calendario (en Roma) que faltan hasta una fecha. 0 = es hoy. */
export function daysUntil(ms: number, date: string): number {
  const today = romeParts(ms).date;
  const a = Date.UTC(...(today.split('-').map(Number) as [number, number, number]).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number]);
  const b = Date.UTC(...(date.split('-').map(Number) as [number, number, number]).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number]);
  return Math.round((b - a) / 86_400_000);
}
