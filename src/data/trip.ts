import type { TripDay, Who } from './types';

export const TIME_ZONE = 'Europe/Rome';

export const travellers: Record<Who, { name: string; device: string }> = {
  jesus: { name: 'Jesús', device: 'Samsung Galaxy S23 Ultra · Chrome' },
  lucia: { name: 'Lucía', device: 'iPhone 15 · Safari' },
};

export const tripStart = '2026-10-30';
export const tripEnd = '2026-11-03';

export const days: TripDay[] = [
  { day: 1, date: '2026-10-30', roman: 'I', label: 'Viernes 30 de octubre' },
  { day: 2, date: '2026-10-31', roman: 'II', label: 'Sábado 31 de octubre' },
  { day: 3, date: '2026-11-01', roman: 'III', label: 'Domingo 1 de noviembre', holiday: 'Festivo: Ognissanti (Todos los Santos)' },
  { day: 4, date: '2026-11-02', roman: 'IV', label: 'Lunes 2 de noviembre' },
  { day: 5, date: '2026-11-03', roman: 'V', label: 'Martes 3 de noviembre' },
];

export const hotel = {
  placeId: 'hotel-soha',
  name: 'Soha Piazza di Spagna Boutique',
  address: 'Via Zucchelli 32',
  floor: '1.º piso con ascensor',
  /** Según la ficha de Expedia (19 oct 2026): verificar en la reserva. */
  reception: 'Recepción 08:00–16:00 · check-in desde las 14:00 · salida antes de las 10:30',
  /** Lo que se enseña al taxista (F21). */
  taxiText: 'Via Zucchelli 32, vicino alla metro Barberini',
  phone: undefined as string | undefined, // ⚠️ Pendiente: verificar en la reserva
  email: undefined as string | undefined, // ⚠️ Pendiente: verificar en la reserva
  bookingRef: undefined as string | undefined, // ⚠️ Pendiente
};

export const flights = {
  outbound: { from: 'SVQ', to: 'FCO', airline: 'Ryanair', date: '2026-10-30', dep: '09:30', arr: '12:35', locator: undefined as string | undefined },
  inbound: { from: 'FCO', to: 'MAD T1', airline: 'Ryanair', date: '2026-11-03', dep: '09:00', arr: '11:30', arrApprox: true, locator: undefined as string | undefined },
  baggage: 'Solo mochila 40×30×20',
};

/** Tren de Lucía a Termini el viernes 30. */
export const luciaTrain = {
  arrivesTermini: '11:45',
  meetingPoint: undefined as 'termini' | 'hotel' | undefined, // ⚠️ Pendiente de confirmar
};

export const budget = {
  /** Comida: unos 193 € por persona en todo el viaje; tope 200 €. */
  foodPlannedPPCents: 19300,
  foodCapPPCents: 20000,
  drinksPerNightCents: { min: 1500, max: 2000 },
  tickets: {
    jesus: { minCents: 4600, maxCents: 5100 },
    lucia: { minCents: 3600, maxCents: 4100 },
  },
};
