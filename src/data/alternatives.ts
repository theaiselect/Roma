import type { DayNum, Stop } from './types';

// Plan de lluvia (F06): sustituye las paradas al aire libre de la tarde por sitios bajo techo
// sacados de la lista de monumentos del documento (💡). Horarios y precios: verificar.
export interface RainPlan { day: DayNum; replaces: string[]; stops: Omit<Stop, 'day'>[] }

export const rainPlans: RainPlan[] = [
  { day: 1, replaces: ['d1-borghese', 'd1-pincio'], stops: [
    { id: 'r1-vittoria', start: '16:00', placeId: 'santa-maria-vittoria', title: 'Santa Maria della Vittoria (Éxtasis de Santa Teresa, Bernini)', note: 'A 5 min del hotel. Horario: verificar.' },
    { id: 'r1-hotel', start: '16:45', placeId: 'hotel-soha', title: 'Descanso en el hotel y seguir a Piazza del Popolo en metro (Flaminio)' },
  ] },
  { day: 2, replaces: ['d2-circo', 'd2-aventino'], stops: [
    { id: 'r2-capitolini', start: '15:50', placeId: 'musei-capitolini', title: 'Museos Capitolinos', note: 'Junto al Campidoglio. Horario y precio: verificar.' },
  ] },
  { day: 3, replaces: ['d3-gianicolo-up', 'd3-sunset', 'd3-tempietto'], stops: [
    { id: 'r3-sanluigi', start: '16:15', placeId: 'san-luigi', title: 'San Luigi dei Francesi (Caravaggio)', note: 'Horario en festivo: verificar.' },
    { id: 'r3-ignazio', start: '17:00', placeId: 'sant-ignazio', title: "Sant'Ignazio (la falsa cúpula)", note: 'Horario en festivo: verificar.' },
  ] },
  { day: 4, replaces: ['d4-vittoriano', 'd4-campidoglio'], stops: [
    { id: 'r4-vincoli', start: '16:40', placeId: 'san-pietro-vincoli', title: 'San Pietro in Vincoli (Moisés de Miguel Ángel)', note: 'De camino a Monti y a la cena. Horario: verificar.' },
  ] },
];

// Punto de encuentro si os separáis (F22).
export const meetingRule = 'Si os separáis y no hay cobertura: id al punto de encuentro del día y esperad allí a la siguiente hora en punto o y media.';

export const meetingPoints: Record<DayNum, { place: string; placeId?: string }> = {
  1: { place: 'Obelisco de Piazza del Popolo', placeId: 'piazza-popolo' },
  2: { place: 'Arco de Constantino (lado del Coliseo)', placeId: 'colosseo' },
  3: { place: "Puerta de Castel Sant'Angelo, junto al puente", placeId: 'castel-santangelo' },
  4: { place: 'Obelisco de la Plaza de San Pedro', placeId: 'san-pietro' },
  5: { place: 'Andenes del Leonardo Express en Termini (23–24)', placeId: 'termini' },
};
