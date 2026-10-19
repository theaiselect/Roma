import type { Reservation } from './types';

// Estado según el documento (18 oct 2026). Se actualiza desde la app (F11, sincronizado).
export const reservations: Reservation[] = [
  { id: 'vaticani', title: 'Museos Vaticanos', status: 'todo', day: 4, time: '08:00', note: '1 Intero (Jesús) + 1 Ridotto (Lucía, carnet universitario), 40 € en total. Comprobar si Jesús puede sacar Ridotto con carnet ISIC.' },
  { id: 'colosseo', title: 'Coliseo · Full Experience Arena', status: 'todo', day: 2, time: '08:30', url: 'https://ticketing.colosseo.it', note: 'A la venta 30 días antes: mirar ya. Seguro: entrada estándar de 24 h. Nominativa, llevar DNI.' },
  { id: 'borghese', title: 'Galleria Borghese', status: 'soldout', url: 'https://www.tosc.it', note: 'Agotada. Mirar cancelaciones; plan B: Palazzo Barberini.' },
  { id: 'pantheon', title: 'Panteón', status: 'bought', day: 4, time: '15:00', note: 'Franja 15:00–16:00, 2 entradas con descuento, 4 € en total.' },
  { id: 'felice', title: 'Felice a Testaccio', status: 'todo', day: 2, time: '19:30', phone: '+39 06 574 6800' },
  { id: 'taverna', title: 'Taverna dei Fori Imperiali', status: 'todo', day: 4, time: '19:45', phone: '+39 06 679 8643' },
  { id: 'uber', title: 'Uber Reserve 07:40 en Plaza de Armas', status: 'todo', day: 1, time: '07:40' },
  { id: 'bus-sevilla', title: 'Bus Plasencia → Sevilla', status: 'pending', day: 1, time: '03:05', note: 'Confirmar hora y número de billete.' },
  { id: 'ryanair', title: 'Ryanair ida y vuelta', status: 'pending', note: 'Check-in online y tarjeta de embarque en myRyanair. Localizadores pendientes.' },
  { id: 'madrid-plasencia', title: 'Madrid → Plasencia', status: 'todo', day: 5, note: 'Desde las 13:30–14:00.' },
  { id: 'hotel-mensaje', title: 'Mensaje al hotel', status: 'todo', note: 'Dejar mochilas el viernes, salida el martes a las 05:30, tasa turística.' },
  { id: 'tse', title: 'Tarjeta Sanitaria Europea de los dos', status: 'todo' },
];
