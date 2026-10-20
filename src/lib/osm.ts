// Servicios gratuitos y sin clave, todos con datos de OpenStreetMap:
//  · Mapa: OpenFreeMap (teselas vectoriales).  · Ruta a pie: routing.openstreetmap.de (OSRM, perfil «foot»).
//  · Buscador: Photon (komoot).  · Fuentes, baños, farmacias, cafés y heladerías: Overpass.
// Todo falla con elegancia: sin red, la app sigue con lo guardado y con los enlaces a Google/Apple Maps.
import { getMeta, setMeta } from '@/lib/db';
import { offlineRoute, reverseOffline, searchOffline } from '@/lib/offline-data'; // solo se usan al llamar (hay un ciclo de módulos inofensivo)
import { distanceM, type LatLng } from '@/lib/geo';
import { parseSteps, type OsrmStep, type Step } from '@/lib/nav';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
/** Centro histórico y alrededores del hotel, Vaticano, Trastevere, Coliseo y Villa Borghese. */
export const ROME_BBOX = { west: 12.40, south: 41.84, east: 12.57, north: 41.95 } as const;
/** Zona que se descarga para el mapa sin conexión: Roma entera y el aeropuerto de Fiumicino. */
export const DOWNLOAD_BBOX = { west: 12.20, south: 41.76, east: 12.62, north: 42.00 } as const;
export const ROME_CENTER: LatLng = { lat: 41.9028, lng: 12.4964 };

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 9000): Promise<T | null> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

// ── Ruta a pie ──────────────────────────────────────────────────
export interface Leg { distanceM: number; durationS: number }
export interface Route { distanceM: number; durationS: number; coords: [number, number][]; steps: Step[]; legs: Leg[]; offline?: boolean }

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs?: { distance?: number; duration?: number; steps?: OsrmStep[] }[] }[];
}

export function parseOsrm(r: OsrmResponse | null): Route | null {
  const x = r?.code === 'Ok' ? r.routes?.[0] : undefined;
  if (!x) return null;
  return {
    distanceM: x.distance, durationS: x.duration, coords: x.geometry.coordinates,
    steps: parseSteps(x.legs), legs: (x.legs ?? []).map((l) => ({ distanceM: l.distance ?? 0, durationS: l.duration ?? 0 })),
  };
}

/** Ruta a pie por varios puntos, en orden (sirve para «la ruta del día»). Con un solo tramo es la ruta de siempre. */
export async function footRouteVia(points: LatLng[]): Promise<Route | null> {
  if (points.length < 2) return null;
  if (navigator.onLine) {
    const path = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${path}?overview=full&geometries=geojson&steps=true`;
    const online = parseOsrm(await getJson<OsrmResponse>(url, undefined, 7000));
    if (online) return online;
  }
  // sin red (o el servicio no responde): calles guardadas en el móvil
  const off = await offlineRoute(points).catch(() => null);
  return off ? { ...off, offline: true } : null;
}

export const footRoute = (from: LatLng, to: LatLng): Promise<Route | null> => footRouteVia([from, to]);

// ── Buscador ────────────────────────────────────────────────────
export interface Found { id: string; name: string; detail: string; lat: number; lng: number }

interface PhotonResponse { features?: { geometry: { coordinates: [number, number] }; properties: { osm_id?: number; osm_type?: string; name?: string; street?: string; housenumber?: string; district?: string; city?: string; type?: string } }[] }

export function parsePhoton(r: PhotonResponse | null): Found[] {
  return (r?.features ?? []).flatMap((f, i) => {
    const p = f.properties;
    const name = p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ');
    if (!name) return [];
    const detail = [p.street && p.name ? [p.street, p.housenumber].filter(Boolean).join(' ') : '', p.district, p.city].filter(Boolean).join(', ');
    return [{ id: `${p.osm_type ?? 'x'}${p.osm_id ?? i}`, name, detail, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }];
  });
}

export async function searchPlaces(q: string): Promise<Found[] | null> {
  const query = q.trim();
  if (query.length < 3) return [];
  const offline = async () => searchOffline(query).catch(() => null);
  if (!navigator.onLine) return offline();
  const b = ROME_BBOX;
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lat=${ROME_CENTER.lat}&lon=${ROME_CENTER.lng}&bbox=${b.west - 0.15},${b.south - 0.1},${b.east + 0.15},${b.north + 0.1}`;
  const r = await getJson<PhotonResponse>(url, undefined, 6000);
  return r ? parsePhoton(r) : offline();
}

/** Qué hay en un punto del mapa (pulsación larga). */
export async function reverseGeocode(p: LatLng): Promise<Found | null> {
  const offline = async () => reverseOffline(p).catch(() => null);
  if (!navigator.onLine) return offline();
  const r = await getJson<PhotonResponse>(`https://photon.komoot.io/api/reverse?lat=${p.lat}&lon=${p.lng}&limit=1`, undefined, 6000);
  const f = r ? parsePhoton(r)[0] : undefined;
  return f ? { ...f, lat: p.lat, lng: p.lng } : offline();
}

// ── Puntos de interés (Overpass) ────────────────────────────────
export type PoiKind = 'fountain' | 'toilets' | 'pharmacy' | 'cafe' | 'gelato';
export interface Poi { id: string; kind: PoiKind; name: string; lat: number; lng: number; note?: string }

interface OverpassElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function kindOf(t: Record<string, string>): PoiKind | null {
  if (t.amenity === 'drinking_water') return 'fountain';
  if (t.amenity === 'toilets') return 'toilets';
  if (t.amenity === 'pharmacy') return 'pharmacy';
  if (t.amenity === 'ice_cream' || t.shop === 'ice_cream') return 'gelato';
  if (t.amenity === 'cafe') return 'cafe';
  return null;
}

const LABEL: Record<PoiKind, string> = { fountain: 'Fuente de agua potable (nasone)', toilets: 'Baño público', pharmacy: 'Farmacia', cafe: 'Café', gelato: 'Heladería' };

export function parseOverpass(r: { elements?: OverpassElement[] } | null): Poi[] {
  const out: Poi[] = [];
  for (const e of r?.elements ?? []) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const t = e.tags ?? {};
    const kind = kindOf(t);
    if (!kind || lat === undefined || lng === undefined) continue;
    const note = kind === 'toilets' ? [t.fee === 'yes' ? 'De pago' : t.fee === 'no' ? 'Gratis' : '', t.wheelchair === 'yes' ? 'Accesible' : ''].filter(Boolean).join(' · ') : t.opening_hours;
    out.push({ id: `${e.type[0]}${e.id}`, kind, name: t.name ?? LABEL[kind], lat, lng, note: note || undefined });
  }
  return out;
}

export function overpassQuery(): string {
  const { south, west, north, east } = ROME_BBOX;
  const bb = `${south},${west},${north},${east}`;
  const sel = ['amenity=drinking_water', 'amenity=toilets', 'amenity=pharmacy', 'amenity=cafe', 'amenity=ice_cream', 'shop=ice_cream'];
  return `[out:json][timeout:40];(${sel.map((s) => `nwr[${s}](${bb});`).join('')});out center tags;`;
}

interface PoiCache { at: number; pois: Poi[] }
const POI_KEY = 'osm-pois';
const POI_MAX_AGE = 14 * 86_400_000;

/** Lo guardado en el móvil (sin red). */
export async function cachedPois(): Promise<PoiCache | undefined> {
  return getMeta<PoiCache>(POI_KEY);
}

/** Descarga los puntos de OpenStreetMap si no hay copia reciente. Devuelve la copia que quede. */
export async function refreshPois(force = false, now = Date.now()): Promise<PoiCache | undefined> {
  const cur = await cachedPois();
  if (cur && !force && now - cur.at < POI_MAX_AGE) return cur;
  const r = await getJson<{ elements?: OverpassElement[] }>('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpassQuery())}`,
  }, 45_000);
  const pois = parseOverpass(r);
  if (!pois.length) return cur;
  const next = { at: now, pois };
  await setMeta(POI_KEY, next);
  return next;
}

export function nearest(pois: Poi[], kind: PoiKind, from: LatLng, limit = 12): { poi: Poi; d: number }[] {
  return pois
    .filter((p) => p.kind === kind)
    .map((poi) => ({ poi, d: distanceM(from, poi) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

export function formatDuration(s: number): string {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Dirección → coordenadas (Photon), guardada para no repetir la consulta. Sirve para lo que el documento no trae (el hotel). */
export async function geocodeCached(key: string, query: string): Promise<LatLng | null> {
  const k = `geo:${key}`;
  const hit = await getMeta<LatLng>(k);
  if (hit) return hit;
  const found = (await searchPlaces(query))?.[0];
  if (!found) return null;
  const pos = { lat: found.lat, lng: found.lng };
  await setMeta(k, pos);
  return pos;
}
