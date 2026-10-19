import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import type { DayNum, Who } from '@/data/types';

// Todo en céntimos enteros.

export type Category = 'comida' | 'copas' | 'entradas' | 'transporte' | 'otros';
export const CATEGORIES: [Category, string][] = [['comida', 'Comida'], ['copas', 'Copas'], ['entradas', 'Entradas'], ['transporte', 'Transporte'], ['otros', 'Otros']];

export interface ExpenseLike {
  amountCents: number;
  paidBy: Who;
  split: Record<Who, number>;
  category: Category;
  day: DayNum | null;
  deleted?: boolean;
}

const OTHER: Record<Who, Who> = { jesus: 'lucia', lucia: 'jesus' };

/** Reparto a partes iguales. El céntimo impar lo asume quien paga. */
export function equalSplit(amountCents: number, paidBy: Who): Record<Who, number> {
  const other = Math.floor(amountCents / 2);
  return { [paidBy]: amountCents - other, [OTHER[paidBy]]: other } as Record<Who, number>;
}

/** Reparto personalizado a partir de la parte de uno; el resto es del otro. */
export function customSplit(amountCents: number, who: Who, partCents: number): Record<Who, number> {
  const p = Math.min(Math.max(0, Math.round(partCents)), amountCents);
  return { [who]: p, [OTHER[who]]: amountCents - p } as Record<Who, number>;
}

/** Convierte «12,50», «12.5» o «12» a céntimos. null si no es válido. */
export function parseEuros(s: string): number | null {
  const t = s.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [ent, dec = ''] = t.split('.') as [string, string?];
  return Number(ent) * 100 + Number((dec + '00').slice(0, 2));
}

export interface Balance {
  paid: Record<Who, number>;
  share: Record<Who, number>;
  /** Quién debe a quién y cuánto (0 = en paz). */
  debtor: Who | null;
  amountCents: number;
  totalCents: number;
}

export function balance(expenses: ExpenseLike[]): Balance {
  const paid = { jesus: 0, lucia: 0 };
  const share = { jesus: 0, lucia: 0 };
  for (const e of expenses) {
    if (e.deleted) continue;
    paid[e.paidBy] += e.amountCents;
    share.jesus += e.split.jesus;
    share.lucia += e.split.lucia;
  }
  const netJesus = paid.jesus - share.jesus; // >0: a Jesús le deben
  return {
    paid, share,
    debtor: netJesus > 0 ? 'lucia' : netJesus < 0 ? 'jesus' : null,
    amountCents: Math.abs(netJesus),
    totalCents: paid.jesus + paid.lucia,
  };
}

/** Comida planificada por persona y día (suma de los precios por persona del itinerario). */
export function plannedFoodByDay(): Record<DayNum, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DayNum, number>;
  for (const s of itinerary) {
    const p = s.placeId ? placeById.get(s.placeId) : undefined;
    if (p?.pricePPCents && ['food', 'cafe', 'gelato'].includes(p.kind)) out[s.day] += p.pricePPCents;
  }
  return out;
}

export type Light = 'green' | 'ocre' | 'vino';

/** Semáforo (F25): verde por debajo del plan, ocre hasta +10 %, vino por encima. */
export function light(spentCents: number, planCents: number): Light {
  if (spentCents <= planCents) return 'green';
  if (spentCents <= Math.round(planCents * 1.1)) return 'ocre';
  return 'vino';
}

/** Gasto en comida por persona (su parte) y día. */
export function foodSpentByDay(expenses: ExpenseLike[], who: Who): Record<DayNum, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DayNum, number>;
  for (const e of expenses) if (!e.deleted && e.category === 'comida' && e.day) out[e.day] += e.split[who];
  return out;
}
