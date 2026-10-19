import * as SunCalcNs from 'suncalc';
import { romeToUtc } from '@/lib/time';

// suncalc es CommonJS: según el empaquetador llega como default o como espacio de nombres.
const SunCalc = ((SunCalcNs as unknown as { default?: typeof SunCalcNs }).default ?? SunCalcNs) as typeof SunCalcNs;

export const ROME = { lat: 41.9028, lng: 12.4964 };

/** Atardecer en Roma para una fecha 'YYYY-MM-DD' (F08). Cálculo local, sin red. */
export function sunsetAt(date: string): number {
  // Mediodía en Roma para quedarnos en el día correcto.
  return SunCalc.getTimes(new Date(romeToUtc(date, '12:00')), ROME.lat, ROME.lng).sunset!.getTime();
}
