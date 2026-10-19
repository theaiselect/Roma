import { useEffect, useState } from 'preact/hooks';
import { ROME } from '@/lib/sun';

// Tiempo (F07): Open-Meteo, gratis y sin clave. Se guarda la última previsión para verla sin conexión.
export interface DayForecast { date: string; code: number; tmax: number; tmin: number; rainProb: number | null }
export interface Forecast { fetchedAt: number; days: DayForecast[] }

const KEY = 'roma-weather';
const URL_ = `https://api.open-meteo.com/v1/forecast?latitude=${ROME.lat}&longitude=${ROME.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FRome&forecast_days=16`;

export function parseForecast(json: unknown, now = Date.now()): Forecast | null {
  const d = (json as { daily?: Record<string, unknown[]> })?.daily;
  if (!d || !Array.isArray(d.time)) return null;
  const days = (d.time as string[]).map((date, i) => ({
    date,
    code: Number(d.weather_code?.[i] ?? 0),
    tmax: Math.round(Number(d.temperature_2m_max?.[i])),
    tmin: Math.round(Number(d.temperature_2m_min?.[i])),
    rainProb: d.precipitation_probability_max?.[i] == null ? null : Number(d.precipitation_probability_max[i]),
  }));
  return { fetchedAt: now, days };
}

/** Código WMO → texto corto en español. */
export function weatherText(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Algunas nubes';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Niebla';
  if (code >= 51 && code <= 57) return 'Llovizna';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Lluvia';
  if (code >= 71 && code <= 77) return 'Nieve';
  if (code >= 95) return 'Tormenta';
  return 'Variable';
}

export function isRainy(code: number, prob: number | null): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 99) || (prob ?? 0) >= 60;
}

function cached(): Forecast | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Forecast | null; } catch { return null; }
}

export function useForecast(): Forecast | null {
  const [f, setF] = useState<Forecast | null>(cached);
  useEffect(() => {
    const c = cached();
    if (c && Date.now() - c.fetchedAt < 3 * 3600_000) return;
    if (!navigator.onLine) return;
    fetch(URL_).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const parsed = parseForecast(j);
      if (parsed) { setF(parsed); try { localStorage.setItem(KEY, JSON.stringify(parsed)); } catch { /* ignore */ } }
    }).catch(() => undefined);
  }, []);
  return f;
}

export function ageText(fetchedAt: number, now = Date.now()): string {
  const h = Math.floor((now - fetchedAt) / 3600_000);
  if (h < 1) return 'actualizado hace menos de 1 h';
  if (h < 48) return `actualizado hace ${h} h`;
  return `actualizado hace ${Math.floor(h / 24)} días`;
}
