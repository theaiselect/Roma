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
  address: 'Via Zucchelli 32, 00187 Roma',
  floor: '1.º piso con ascensor; fuera no hay cartel del hotel',
  /** Reserva de Booking.com confirmada: entrada vie 30 oct desde las 14:00, salida mar 3 nov a las 05:30 (check-out la víspera). */
  reception: 'Check-in de 14:00 a 19:00 (más tarde, avisar antes) · check-out de 08:00 a 10:30; si salís antes de las 08:00, el check-out se hace la víspera antes de las 19:00 (email del hotel, 24 oct)',
  /** Lo que se enseña al taxista (F21). */
  taxiText: 'Via Zucchelli 32, vicino alla metro Barberini',
  phone: '+39 351 247 3415' as string | undefined,
  email: undefined as string | undefined, // ⚠️ Pendiente: verificar en la reserva
  // Reserva y PIN de Booking: NO van aquí (la app es pública para quien tenga el enlace). Están en el
  // servidor (api/_private.ts) y llegan con el código del viaje: ver lib/private.ts.
};

export const flights = {
  outbound: { from: 'SVQ', to: 'FCO', airline: 'Ryanair', date: '2026-10-30', dep: '09:30', arr: '12:35', locator: undefined as string | undefined },
  inbound: { from: 'FCO', to: 'MAD T1', airline: 'Ryanair', date: '2026-11-03', dep: '09:00', arr: '11:30', arrApprox: true, locator: undefined as string | undefined },
  baggage: 'Solo mochila 40×30×20',
};

/** Tren de Lucía a Termini el viernes 30. */
export const luciaTrain = {
  arrivesTermini: '11:45',
  meetingPoint: 'termini' as 'termini' | 'hotel' | undefined, // confirmado por Jesús (19 oct)
};

export const budget = {
  /** Comida: 230 € por persona en todo el viaje (subido el 24 oct para cenar en Roscioli el viernes).
   *  El plan suma 223 €; el desayuno en barra del domingo (~2–3 €) no tiene sitio fijo. */
  foodPlannedPPCents: 19800,
  foodCapPPCents: 23000,
  drinksPerNightCents: { min: 1500, max: 2000 },
  tickets: {
    // Sin Museos Vaticanos desde el 24 oct (agotados): 20 € menos cada uno.
    jesus: { minCents: 2600, maxCents: 3100 },
    lucia: { minCents: 1600, maxCents: 2100 },
  },
};
