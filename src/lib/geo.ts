// Distancias y tiempo a pie (F05, F20).
export interface LatLng { lat: number; lng: number }

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distancia en línea recta (m), fórmula del haversine. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distancia por calles estimada: línea recta × 1,3. */
export function walkingDistanceM(a: LatLng, b: LatLng): number {
  return distanceM(a, b) * 1.3;
}

/** Minutos a pie a 4,5 km/h por calles. */
export function walkingMinutes(a: LatLng, b: LatLng): number {
  return Math.ceil(walkingDistanceM(a, b) / (4500 / 60));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}

export interface ArrivalCheck { minutes: number; arriveAt: number; marginMin: number | null }

/** ¿Llego a tiempo? Hora estimada de llegada frente a la hora de la parada. */
export function arrival(from: LatLng, to: LatLng, now: number, stopAt: number | null): ArrivalCheck {
  const minutes = walkingMinutes(from, to);
  const arriveAt = now + minutes * 60_000;
  return { minutes, arriveAt, marginMin: stopAt === null ? null : Math.floor((stopAt - arriveAt) / 60_000) };
}

export type GeoResult = { ok: true; pos: LatLng; accuracy: number } | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' };

export function locate(timeoutMs = 10_000): Promise<GeoResult> {
  if (!('geolocation' in navigator)) return Promise.resolve({ ok: false, reason: 'unsupported' });
  return new Promise((res) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res({ ok: true, pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy }),
      (e) => res({ ok: false, reason: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export function geoHelp(reason: Exclude<GeoResult, { ok: true }>['reason'], ios: boolean): string {
  if (reason === 'denied') {
    return ios
      ? 'Sin permiso de ubicación. En el iPhone: Ajustes → Privacidad y seguridad → Localización → Safari (o Sitios web de Safari) → «Al usarse».'
      : 'Sin permiso de ubicación. En Chrome: toca el candado junto a la dirección → Permisos → Ubicación → Permitir.';
  }
  if (reason === 'timeout' || reason === 'unavailable') return 'No se ha podido saber dónde estás. Prueba al aire libre o activa la ubicación del móvil.';
  return 'Este navegador no permite saber la ubicación.';
}

export interface Fix { pos: LatLng; accuracy: number; heading: number | null }

/** Sigue la posición mientras `onFix` esté activo. Devuelve cómo pararlo. El rumbo solo es fiable andando. */
export function watchPosition(onFix: (f: Fix) => void, onError: (reason: 'denied' | 'unavailable' | 'unsupported') => void): () => void {
  if (!('geolocation' in navigator)) { onError('unsupported'); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({
      pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy,
      heading: typeof p.coords.heading === 'number' && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 0.4 ? p.coords.heading : null,
    }),
    (e) => onError(e.code === 1 ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
