import type { DayKey, Place, Stop } from '@/data/types';
import { days } from '@/data/trip';
import { romeParts, romeToUtc } from '@/lib/time';

export interface TimedStop extends Stop {
  /** Instante de inicio (ms) o null si la parada no tiene hora. */
  at: number | null;
  date: string;
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function dayDate(day: Stop['day']): string {
  return days.find((d) => d.day === day)!.date;
}

/** Calcula el instante de cada parada en hora de Roma. */
export function timeline(stops: Stop[]): TimedStop[] {
  return stops.map((s) => {
    const base = dayDate(s.day);
    const date = s.afterMidnight ? addDays(base, 1) : base;
    return { ...s, date, at: s.start ? romeToUtc(date, s.start) : null };
  });
}

export interface NowState {
  phase: 'before' | 'during' | 'after';
  /** Parada en curso (la última que ya empezó hoy). */
  current: TimedStop | null;
  /** Próxima parada con hora. */
  next: TimedStop | null;
  /** Las siguientes después de `next` (máx. 3). */
  then: TimedStop[];
  msToNext: number | null;
}

export function nowState(stops: TimedStop[], now: number): NowState {
  const timed = stops.filter((s) => s.at !== null) as (TimedStop & { at: number })[];
  const first = timed[0];
  const last = timed[timed.length - 1];
  if (!first || !last) return { phase: 'before', current: null, next: null, then: [], msToNext: null };

  const nextIdx = timed.findIndex((s) => s.at > now);
  const next = nextIdx === -1 ? null : timed[nextIdx]!;
  const current = nextIdx === 0 ? null : timed[nextIdx === -1 ? timed.length - 1 : nextIdx - 1]!;
  const then = nextIdx === -1 ? [] : timed.slice(nextIdx + 1, nextIdx + 4);
  // El viaje «acaba» 12 h después de la última parada.
  const phase = now < first.at ? 'before' : now > last.at + 12 * 3600_000 ? 'after' : 'during';
  return { phase, current, next, then, msToNext: next ? next.at - now : null };
}

/** «2 h 05 min», «12 min», «ahora». */
export function formatDuration(ms: number): string {
  if (ms <= 30_000) return 'ahora';
  const total = Math.round(ms / 60_000);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

// ── Horarios ────────────────────────────────────────────────────

export type OpenStatus = 'open' | 'closed' | 'closed-today' | 'unknown';

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

const PREV: Record<DayKey, DayKey> = { mon: 'sun', tue: 'mon', wed: 'tue', thu: 'wed', fri: 'thu', sat: 'fri', sun: 'sat' };

/** ¿Abre ese día? `null` si el documento no lo dice. */
export function opensOn(place: Place, day: DayKey): boolean | null {
  const v = place.hours?.[day];
  if (v === undefined) return null;
  return v !== null;
}

/** Estado en un instante. Tiene en cuenta tramos que cruzan la medianoche. */
export function openStatus(place: Place, ms: number): OpenStatus {
  if (!place.hours) return 'unknown';
  const p = romeParts(ms);
  const minute = p.h * 60 + p.mi;
  const today = place.hours[p.weekday];
  const yesterday = place.hours[PREV[p.weekday]];

  // Tramo de ayer que sigue abierto pasada la medianoche.
  if (yesterday) {
    for (const span of yesterday.split(',')) {
      const [a, b] = span.split('-') as [string, string];
      if (toMin(b) < toMin(a) && minute < toMin(b)) return 'open';
    }
  }
  if (today === undefined) return 'unknown';
  if (today === null) return 'closed-today';
  for (const span of today.split(',')) {
    const [a, b] = span.split('-') as [string, string];
    const start = toMin(a);
    const end = toMin(b) <= start ? 24 * 60 : toMin(b);
    if (minute >= start && minute < end) return 'open';
  }
  return 'closed';
}
