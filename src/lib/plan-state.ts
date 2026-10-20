import { rainPlans } from '@/data/alternatives';
import { itinerary } from '@/data/itinerary';
import type { DayNum, Stop } from '@/data/types';
import { save, useKind, type Entity } from '@/lib/db';
import { timeline, type TimedStop } from '@/lib/schedule';

// Estado compartido del viaje: modo lluvia por día (F06) y punto de encuentro (F22).
export interface StateEntity extends Entity { kind: 'state'; key: string; value: unknown }

export function useSharedState(): Map<string, StateEntity> {
  const all = useKind<StateEntity>('state') ?? [];
  return new Map(all.map((s) => [s.key, s]));
}

export function setShared(key: string, value: unknown): Promise<Entity> {
  return save({ id: `state:${key}`, kind: 'state', key, value });
}

/** Clave del punto de encuentro de cada día en el estado compartido. */
export const meetingKey = (day: DayNum): string => `meeting:${day}`;

export function rainDays(state: Map<string, StateEntity>): Set<DayNum> {
  const out = new Set<DayNum>();
  for (const [k, v] of state) if (k.startsWith('rain:') && v.value === true) out.add(Number(k.slice(5)) as DayNum);
  return out;
}

/** Itinerario con los planes de lluvia aplicados en los días activados. */
export function applyRain(stops: Stop[], days: ReadonlySet<DayNum>): Stop[] {
  if (!days.size) return stops;
  const out: Stop[] = [];
  for (const s of stops) {
    const plan = rainPlans.find((p) => p.day === s.day && days.has(p.day));
    if (plan?.replaces.includes(s.id)) {
      if (s.id === plan.replaces[0]) out.push(...plan.stops.map((r) => ({ ...r, day: plan.day, note: `☔ ${r.note ?? 'Plan de lluvia'}` })));
      continue;
    }
    out.push(s);
  }
  return out;
}

export function useTimeline(): TimedStop[] {
  const state = useSharedState();
  return timeline(applyRain(itinerary, rainDays(state)));
}
