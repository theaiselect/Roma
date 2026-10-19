import type { Reservation, ReservationStatus } from '@/data/types';
import { days } from '@/data/trip';

/** Orden de los grupos: primero lo que hay que hacer, lo comprado al final. */
const RANK: Record<ReservationStatus, number> = { todo: 0, pending: 1, soldout: 2, bought: 3 };

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  bought: 'Comprado',
  pending: 'Pendiente de datos',
  todo: 'Por hacer',
  soldout: 'Agotado',
};

/** Ordena por estado y, dentro de cada estado, por día y hora (lo que no tiene día, al final). */
export function sortReservations(list: readonly Reservation[], statusOf: (r: Reservation) => ReservationStatus): Reservation[] {
  return [...list].sort((a, b) =>
    RANK[statusOf(a)] - RANK[statusOf(b)]
    || (a.day ?? 99) - (b.day ?? 99)
    || (a.time ?? '99:99').localeCompare(b.time ?? '99:99'),
  );
}

export interface ReservationCounts { todo: number; pending: number; soldout: number; bought: number; open: number; total: number }

export function countReservations(list: readonly Reservation[], statusOf: (r: Reservation) => ReservationStatus): ReservationCounts {
  const c: ReservationCounts = { todo: 0, pending: 0, soldout: 0, bought: 0, open: 0, total: list.length };
  for (const r of list) c[statusOf(r)]++;
  c.open = c.todo + c.pending;
  return c;
}

/** Fecha 'YYYY-MM-DD' del día del viaje al que se refiere la reserva (si tiene). */
export function reservationDate(r: Reservation): string | undefined {
  return r.day ? days.find((d) => d.day === r.day)?.date : undefined;
}

export function untilText(n: number): string {
  if (n < 0) return 'ya pasó';
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}
