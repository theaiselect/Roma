import type { TimedStop } from '@/lib/schedule';

export type MarginLevel = 'ok' | 'tight' | 'late';

export interface LegView {
  stop: TimedStop;
  done: boolean;
  /** Solo en el primer tramo pendiente: minutos hasta que empieza. */
  marginMin: number | null;
  level: MarginLevel | null;
}

export function marginLevel(min: number): MarginLevel {
  if (min < 0) return 'late';
  if (min < 20) return 'tight';
  return 'ok';
}

/**
 * Modo día de viaje (F03). El margen en vivo se mide en el primer tramo sin marcar:
 * minutos que quedan hasta su hora. Ocre por debajo de 20 min, vino por debajo de 0.
 */
export function legViews(legs: TimedStop[], doneIds: ReadonlySet<string>, now: number): LegView[] {
  let marked = false;
  return legs.map((stop) => {
    const done = doneIds.has(stop.id);
    // Un tramo de hace más de una hora sin marcar se da por pasado: el margen va al siguiente.
    const stale = stop.at !== null && now - stop.at > 60 * 60_000;
    if (done || marked || stop.at === null || stale) return { stop, done, marginMin: null, level: null };
    marked = true;
    const marginMin = Math.floor((stop.at - now) / 60_000);
    return { stop, done, marginMin, level: marginLevel(marginMin) };
  });
}
