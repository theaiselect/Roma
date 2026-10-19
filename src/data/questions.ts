import type { DayNum } from './types';

// Pregunta del día (F43): cada uno responde y las respuestas se ven cuando han respondido los dos.
export const questions: Record<DayNum, string> = {
  1: '¿Qué es lo que más te apetecía de este viaje, antes de llegar?',
  2: '¿En qué momento de hoy has pensado «qué suerte tengo»?',
  3: 'Si pudiéramos quedarnos a vivir en un barrio de Roma, ¿cuál sería y por qué?',
  4: '¿Qué te ha sorprendido de mí en estos días?',
  5: '¿Qué tres cosas de Roma te llevas para siempre?',
};

export function questionId(date: string): string {
  return `q-${date}`;
}
