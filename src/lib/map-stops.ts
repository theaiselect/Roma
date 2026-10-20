import type { DayNum } from '@/data/types';
import type { TimedStop } from '@/lib/schedule';

// Paradas de un día tal como se dibujan en el mapa: numeradas 1, 2, 3… en el orden en que se hacen.
export type StopStatus = 'todo' | 'done' | 'now' | 'next';

export interface MapStop {
  /** Un sitio = un número, aunque se visite dos veces en el día (sale el número de la primera visita). */
  placeId: string;
  n: number;
  lat: number;
  lng: number;
  /** Lo que hacemos ahí (título de la primera visita). */
  title: string;
  visits: TimedStop[];
  status: StopStatus;
}

export interface DayStops {
  stops: MapStop[];
  /** Recorrido real del día: las visitas en orden, sin repetir el mismo sitio dos veces seguidas. */
  path: MapStop[];
}

export interface BuildOptions {
  now: number;
  /** Ids de paradas marcadas como hechas (casilla del Plan). */
  done: ReadonlySet<string>;
  /** Coordenadas de un sitio (null si no se conocen: esa parada no sale en el mapa). */
  resolve: (placeId: string) => { lat: number; lng: number } | undefined;
  currentId?: string | null;
  nextId?: string | null;
}

export const DONE_AFTER_MS = 45 * 60_000;

function visitStatus(s: TimedStop, o: BuildOptions): StopStatus {
  if (o.currentId === s.id) return 'now';
  if (o.nextId === s.id) return 'next';
  // Igual que en el resto de la app: una parada se da por hecha 45 min después de su hora (o al marcarla).
  if (o.done.has(s.id) || (s.at !== null && s.at + DONE_AFTER_MS < o.now)) return 'done';
  return 'todo';
}

export function buildDayStops(tl: readonly TimedStop[], day: DayNum, o: BuildOptions): DayStops {
  const seq = tl.filter((s) => s.day === day && s.placeId && o.resolve(s.placeId));
  const byPlace = new Map<string, MapStop>();
  const order: MapStop[] = [];
  for (const s of seq) {
    const id = s.placeId!;
    const at = o.resolve(id)!;
    let m = byPlace.get(id);
    if (!m) {
      m = { placeId: id, n: byPlace.size + 1, lat: at.lat, lng: at.lng, title: s.title, visits: [], status: 'todo' };
      byPlace.set(id, m);
    }
    m.visits.push(s);
    if (order[order.length - 1] !== m) order.push(m);
  }
  const stops = [...byPlace.values()];
  for (const m of stops) {
    const st = m.visits.map((v) => visitStatus(v, o));
    m.status = st.includes('now') ? 'now' : st.includes('next') ? 'next' : st.every((x) => x === 'done') ? 'done' : 'todo';
  }
  return { stops, path: order };
}

/** Texto corto para la etiqueta del mapa. */
export function shortTitle(t: string, max = 24): string {
  const clean = t.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** La parada que toca ahora o la siguiente del día (para el aviso sobre el mapa). */
export function upcoming(stops: readonly MapStop[]): MapStop | undefined {
  return stops.find((s) => s.status === 'now') ?? stops.find((s) => s.status === 'next');
}

export const ARRIVAL_RADIUS_M = 45;

/** Parada del día en la que estás (a menos de `radius` m) y de la que aún no se ha avisado. */
export function arrivedAt(me: { lat: number; lng: number }, stops: readonly MapStop[], greeted: ReadonlySet<string>, dist: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number, radius = ARRIVAL_RADIUS_M): MapStop | undefined {
  return stops.filter((s) => !greeted.has(s.placeId) && dist(me, s) <= radius).sort((a, b) => dist(me, a) - dist(me, b))[0];
}

/** Frases cariñosas para el momento de llegar a un sitio (una por parada, siempre la misma). */
export const ARRIVAL_LINES = [
  'Roma, al revés, es amor.',
  'Lo mejor de este sitio es con quién lo estás pisando.',
  'Dentro de muchos años os acordaréis de este momento.',
  'Hoy Roma es solo vuestra.',
  'Un sitio más que ya es de los dos.',
  'Mírala un segundo a ella, no al móvil.',
  'Qué suerte compartir este rincón.',
  'Haced una foto… y luego guardad el móvil un rato.',
] as const;
export const arrivalLine = (n: number): string => ARRIVAL_LINES[(Math.max(1, n) - 1) % ARRIVAL_LINES.length]!;
