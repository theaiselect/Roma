// Tipos del contenido fijo del viaje (no se sincroniza).
// Regla: ningún dato inventado. Lo que el documento no da queda `undefined`
// y `verified: false`, y la app lo enseña como «verificar».

export type Who = 'jesus' | 'lucia';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayNum = 1 | 2 | 3 | 4 | 5;

export type PlaceKind =
  | 'food' | 'gelato' | 'cafe' | 'bar' | 'monument' | 'transport'
  | 'hotel' | 'health' | 'fountain' | 'area';

/**
 * Horario por día. `null` = cerrado ese día; día ausente = desconocido.
 * Tramos en formato 'HH:mm-HH:mm', varios separados por coma.
 * Un cierre después de medianoche se escribe tal cual ('18:30-02:00').
 */
export type Hours = Partial<Record<DayKey, string | null>>;

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  address?: string;
  lat?: number;
  lng?: number;
  hours?: Hours;
  /** Horario tal como lo da el documento cuando no dice qué días. */
  hoursText?: string;
  phone?: string;
  /** Precio por persona en céntimos. */
  pricePPCents?: number;
  cashOnly?: boolean;
  order?: string[];
  hasToilet?: boolean;
  note?: string;
  verified: boolean;
  source?: string;
}

export interface PlanB { placeId: string; reason: string }

export interface Stop {
  id: string;
  day: DayNum;
  /** 'HH:mm' hora de Roma; `approx` si el documento pone «~». */
  start?: string;
  approx?: boolean;
  end?: string;
  placeId?: string;
  title: string;
  note?: string;
  ticketId?: string;
  planB?: PlanB[];
  rainAlt?: string;
  /** Tramo del modo día de viaje (F03). */
  leg?: boolean;
  pending?: string;
}

export interface TripDay {
  day: DayNum;
  date: string; // YYYY-MM-DD
  roman: 'I' | 'II' | 'III' | 'IV' | 'V';
  label: string;
  holiday?: string;
}

export type MonumentFlag = 'see' | 'pass' | 'maybe' | 'ticket' | 'none';
export interface Monument {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  flag: MonumentFlag;
  placeId?: string;
}

export type ReservationStatus = 'bought' | 'pending' | 'soldout' | 'todo';
export interface Reservation {
  id: string;
  title: string;
  status: ReservationStatus;
  day?: DayNum;
  time?: string;
  url?: string;
  phone?: string;
  note?: string;
}
