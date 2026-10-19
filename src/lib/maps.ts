import type { Place } from '@/data/types';

export function isIOS(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}

function destination(place: Pick<Place, 'name' | 'address' | 'lat' | 'lng'>): string {
  if (place.lat !== undefined && place.lng !== undefined) return `${place.lat},${place.lng}`;
  return [place.name, place.address, 'Roma'].filter(Boolean).join(', ');
}

/** Enlace «Cómo llegar» a pie (F19): Apple Maps en iPhone, Google Maps en el resto. */
export function directionsUrl(place: Pick<Place, 'name' | 'address' | 'lat' | 'lng'>, ios = isIOS()): string {
  const dest = encodeURIComponent(destination(place));
  return ios
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

/** Cómo llegar en transporte público (metro, autobús). */
export function transitUrl(place: Pick<Place, 'name' | 'address' | 'lat' | 'lng'>, ios = isIOS()): string {
  const dest = encodeURIComponent(destination(place));
  return ios ? `https://maps.apple.com/?daddr=${dest}&dirflg=r` : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=transit`;
}

/** Enlace que abre un punto en el mapa del móvil (para compartir dónde estás). */
export function pointUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
