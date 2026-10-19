import { transport } from '@/data/transport';
import { romeParts, romeToUtc } from '@/lib/time';

// Aviso de último metro (F16). De madrugada (antes de las 05:30) cuenta el horario del día anterior.

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Instante de cierre del metro del «día de servicio» en curso. */
export function metroClosing(now: number): number {
  const p = romeParts(now);
  const early = p.h * 60 + p.mi < 5 * 60 + 30;
  const serviceDate = early ? addDays(p.date, -1) : p.date;
  const wd = romeParts(romeToUtc(serviceDate, '12:00')).weekday;
  const late = wd === 'fri' || wd === 'sat';
  const close = (late ? transport.metro.hours.friSat : transport.metro.hours.sunToThu).split('-')[1]!;
  // 01:30 es de la madrugada siguiente.
  return close < '05:00' ? romeToUtc(addDays(serviceDate, 1), close) : romeToUtc(serviceDate, close);
}

/** Texto del aviso si quedan menos de 75 minutos para el cierre; null si no toca. */
export function lastMetroWarning(now: number): string | null {
  const close = metroClosing(now);
  const left = close - now;
  if (left <= 0 || left > 75 * 60_000) return null;
  const hhmm = romeParts(close).time;
  return `El metro cierra a las ${hhmm} (quedan ${Math.round(left / 60_000)} min).`;
}
