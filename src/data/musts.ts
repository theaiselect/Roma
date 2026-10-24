import type { DayNum } from './types';

// «Imprescindible»: lo que hay que recordar sí o sí (pedido por Jesús, 24 oct).
// Sin datos personales: ni localizadores ni DNI (la app es pública para quien tenga el enlace).
export interface MustItem { id: string; text: string; note?: string; /** Sin día: vale para todo el viaje. */ day?: DayNum; time?: string }

export const musts: MustItem[] = [
  { id: 'dni', text: 'DNI siempre encima', note: 'Lo piden en los vuelos y en el Coliseo (la entrada es nominativa).' },
  { id: 'efectivo', text: 'Llevar 100 € en efectivo para todo el viaje', note: '28 € son para la tasa turística del hotel (3,50 € por persona y noche, en recepción). Regoli y Boccione solo aceptan efectivo.' },
  { id: 'hotel', text: 'Hotel: Via Zucchelli 32, 1.º piso. Fuera no hay cartel', note: 'Buscad el portal n.º 32, junto al metro Barberini. Recepción de 08:00 a 19:00; de noche está cerrada.' },
  { id: 'mochila', text: 'Solo la mochila de 40×30×20 en Ryanair', note: 'Batería externa siempre en la mochila, nunca facturada.' },
  { id: 'escalinata', text: 'No sentarse ni comer en la escalinata de Plaza de España', note: 'Hay multa. Tampoco comer en fuentes y monumentos.' },
  { id: 'bus', day: 1, time: '03:05', text: 'Bus Alsa Plasencia → Sevilla', note: 'Sale de la estación de autobuses de Plasencia. Billete en el móvil.' },
  { id: 'uber', day: 1, time: '07:40', text: 'Uber Reserve en Plaza de Armas hasta el aeropuerto', note: 'El vuelo sale a las 09:30.' },
  { id: 'checkin', day: 1, time: '14:15', text: 'Check-in en el hotel', note: 'Hasta las 19:00. Si se pagó la tasa al llegar, el lunes el check-out es más rápido.' },
  { id: 'fortunata', day: 1, time: '20:45', text: 'Cola en Osteria da Fortunata (Panteón)', note: 'Sin reserva: llegar a las 20:45.' },
  { id: 'coliseo', day: 2, time: '08:30', text: 'Coliseo con el DNI', note: 'La entrada es nominativa: sin DNI no se entra.' },
  { id: 'felice', day: 2, time: '21:30', text: 'Cena en Felice a Testaccio', note: 'Guardan la mesa solo 20 min. Si no vais, cancelar como tarde 12 h antes o cobran 15 € por persona.' },
  { id: 'checkout', day: 4, time: '08:45', text: 'Check-out en recepción antes de salir', note: 'Check-out es avisar en recepción de que os vais: pagar lo pendiente (la tasa, si no se pagó) y preguntar dónde dejar la llave. Se hace hoy porque el martes salís a las 05:30 con la recepción cerrada. Esta noche seguís durmiendo en el hotel.' },
  { id: 'ropa', day: 4, text: 'Hombros y rodillas cubiertos', note: 'Si no, no se entra en la Basílica de San Pedro.' },
  { id: 'pantheon', day: 4, time: '15:00', text: 'Panteón a las 15:00 en punto', note: 'La franja es de 15:00 a 16:00: entrar puntuales para aprovechar la hora.' },
  { id: 'bruttone', day: 4, time: '21:30', text: 'Cena en Dar Bruttone (reservada)' },
  { id: 'noche', day: 4, text: 'Antes de dormir: mochilas hechas, alarma a las 05:00 y check-in de Ryanair de vuelta' },
  { id: 'alarma', day: 5, time: '05:00', text: 'Alarma. Salir del hotel a las 05:30', note: 'Dejar la llave donde os haya dicho recepción.' },
  { id: 'vuelo', day: 5, time: '09:00', text: 'Vuelo Fiumicino → Madrid' },
  { id: 'tren', day: 5, time: '16:38', text: 'Tren de Madrid-Atocha Cercanías a Plasencia', note: 'Cambio en Monfragüe a las 19:30.' },
];

export function mustsFor(day: DayNum): MustItem[] {
  return musts.filter((m) => m.day === day);
}
