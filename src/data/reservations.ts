import type { Reservation } from './types';

// Estado según el documento (18 oct 2026). Se actualiza desde la app (F11, sincronizado).
export const reservations: Reservation[] = [
  { id: 'colosseo', title: 'Coliseo', status: 'bought', day: 2, time: '08:30', url: 'https://ticketing.colosseo.it', note: 'Comprado (24 oct). Nominativa: llevar DNI.' },
  { id: 'borghese', title: 'Galleria Borghese', status: 'soldout', url: 'https://www.tosc.it', note: 'Agotada. Mirar cancelaciones; plan B: Palazzo Barberini.' },
  { id: 'pantheon', title: 'Panteón', status: 'bought', day: 4, time: '15:00', note: 'Franja 15:00–16:00, 2 entradas con descuento, 4 € en total.' },
  { id: 'fortunata', title: 'Osteria da Fortunata, Panteón (cena)', status: 'pending', day: 1, time: '21:00', url: 'https://osteriadafortunata.it/prenota/', note: 'Roscioli y Armando estaban llenos (24 oct). A parejas no suelen reservar: si no hay reserva, ir a las 21:00 y esperar turno.' },
  { id: 'felice', title: 'Felice a Testaccio', status: 'bought', day: 2, time: '21:30', phone: '+39 06 574 6800', url: 'https://www.feliceatestaccio.it', note: 'Reservado (24 oct) para 2. Mesa como máximo 2 h y válida hasta 20 min después de la hora. Cancelar como tarde 12 h antes (desde el enlace del email de confirmación) o cobran 15 € por persona.' },
  { id: 'bruttone', title: 'Dar Bruttone, Monti (cena)', status: 'bought', day: 4, time: '21:30', url: 'https://darbruttonerionemonti.plateform.app/r/sitoweb', note: 'Reservado (24 oct) para las 21:30. Sustituye a La Carbonara, que estaba llena.' },
  { id: 'uber', title: 'Uber Reserve 07:40 en Plaza de Armas', status: 'todo', day: 1, time: '07:40' },
  { id: 'bus-sevilla', title: 'Bus Plasencia → Sevilla', status: 'bought', day: 1, time: '03:05', note: 'Alsa, comprado. Llega 07:35 a Plaza de Armas. Cambios y anulación hasta 2 h antes. Localizador: en el email de Alsa.' },
  { id: 'ryanair', title: 'Ryanair ida y vuelta', status: 'pending', note: 'Check-in online y tarjeta de embarque en myRyanair. Localizadores pendientes.' },
  { id: 'madrid-plasencia', title: 'Tren Madrid → Plasencia', status: 'bought', day: 5, time: '16:38', note: 'Renfe, comprado. Alvia 16:38 Atocha Cercanías → Monfragüe 19:19, enlace 19:30 → Plasencia 19:54. Billete: en la app de Renfe.' },
  { id: 'hotel-mensaje', title: 'Mensaje al hotel', status: 'todo', note: 'Dejar mochilas el viernes (check-in desde las 14:00), salida el martes a las 05:30 con la recepción cerrada (abre a las 08:00): preguntar cómo dejar la llave. Tasa turística. WhatsApp/teléfono: +39 351 247 3415.' },
  { id: 'hotel', title: 'Hotel Soha Piazza di Spagna', status: 'bought', day: 1, time: '14:00', phone: '+39 351 247 3415', note: 'Reserva de Booking.com. Entrada desde las 14:00, salida de 08:00 a 11:00 del martes. Cancelación gratis hasta el 26 oct a las 23:59. Referencia y PIN: en Emergencias.' },
  { id: 'tse', title: 'Tarjeta Sanitaria Europea de los dos', status: 'bought', note: 'Pedida (24 oct). Si no llega por correo antes del viaje, descargar el Certificado Provisional Sustitutorio en la sede de la Seguridad Social.' },
];
