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
