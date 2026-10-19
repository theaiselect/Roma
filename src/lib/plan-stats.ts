import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { distanceM } from '@/lib/geo';

/** Kilómetros del plan: tramos entre paradas consecutivas con coordenadas × 1,3 por calles. */
export function plannedKm(day?: DayNum): number {
  let m = 0;
  for (const d of days) {
    if (day && d.day !== day) continue;
    const pts = itinerary.filter((s) => s.day === d.day && !s.leg).map((s) => (s.placeId ? placeById.get(s.placeId) : undefined)).filter((p) => p?.lat !== undefined) as { lat: number; lng: number }[];
    for (let i = 1; i < pts.length; i++) m += distanceM(pts[i - 1]!, pts[i]!) * 1.3;
  }
  return m / 1000;
}

/** «4,2 km» o «800 m». */
export function kmText(km: number): string {
  if (km < 1) return `${Math.round(km * 10) * 100} m`;
  return `${km.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}
