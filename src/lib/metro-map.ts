// Metro de Roma (líneas A, B, B1 y C) a partir de OpenStreetMap: se descarga una vez y se guarda en el móvil.
import { useEffect, useState } from 'preact/hooks';
import { getMeta, setMeta } from '@/lib/db';
import { distanceM, type LatLng } from '@/lib/geo';

export interface MetroLine { ref: string; color: string; /** Tramos [lng, lat][] */ segments: [number, number][][] }
export interface MetroStation { n: string; lat: number; lng: number; lines: string[] }
export interface MetroData { at: number; lines: MetroLine[]; stations: MetroStation[] }

/** Zona de la red que interesa (centro de Roma y alrededores). */
export const METRO_BBOX = { west: 12.38, south: 41.82, east: 12.62, north: 41.97 } as const;
const LINE_COLOR: Record<string, string> = { A: '#E87722', B: '#1F6FB5', B1: '#4FB3E0', C: '#2F9E44' };
const KEY = 'osm-metro';
export const METRO_MAX_AGE = 90 * 86_400_000;

export const metroQuery = (): string => {
  const { south, west, north, east } = METRO_BBOX;
  const bb = `${south},${west},${north},${east}`;
  return `[out:json][timeout:60];rel["route"="subway"](${bb});out geom(${bb});(nwr["railway"="station"]["station"="subway"](${bb});nwr["railway"="station"]["subway"="yes"](${bb}););out center;`;
};

interface Member { type: string; ref: number; role?: string; geometry?: ({ lat: number; lon: number } | null)[] }
interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; members?: Member[] }

/** Distancia (m) de un punto al tramo más cercano de unas líneas. */
export function distToSegmentsM(p: LatLng, segments: [number, number][][]): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180), ky = 110_540;
  let best = Infinity;
  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const ax = (seg[i]![0] - p.lng) * kx, ay = (seg[i]![1] - p.lat) * ky;
      const bx = (seg[i + 1]![0] - p.lng) * kx, by = (seg[i + 1]![1] - p.lat) * ky;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

export function parseMetro(r: { elements?: El[] } | null, at = Date.now()): MetroData | null {
  const els = r?.elements ?? [];
  const lines = new Map<string, MetroLine>();
  const seenWays = new Set<string>();
  for (const e of els) {
    if (e.type !== 'relation' || !e.members) continue;
    const ref = e.tags?.ref?.trim();
    if (!ref) continue;
    const colour = e.tags?.colour ?? e.tags?.color;
    const line = lines.get(ref) ?? { ref, color: LINE_COLOR[ref] ?? (colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : '#7A2E3A'), segments: [] };
    for (const m of e.members) {
      if (m.type !== 'way' || !m.geometry || m.geometry.length < 2) continue;
      const k = `${ref}:${m.ref}`;
      if (seenWays.has(k)) continue; // cada sentido repite las mismas vías
      seenWays.add(k);
      // `out geom(bbox)` deja a null los puntos fuera de la zona: la vía se parte en los trozos que quedan dentro.
      let run: [number, number][] = [];
      for (const g of [...m.geometry, null]) {
        if (g) { run.push([Math.round(g.lon * 1e5) / 1e5, Math.round(g.lat * 1e5) / 1e5]); continue; }
        if (run.length >= 2) line.segments.push(run);
        run = [];
      }
    }
    lines.set(ref, line);
  }
  const list = [...lines.values()].filter((l) => l.segments.length).sort((a, b) => a.ref.localeCompare(b.ref));
  const stations: MetroStation[] = [];
  for (const e of els) {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon; // una estación puede ser un punto o un edificio
    if (e.tags?.railway !== 'station' || lat === undefined || lon === undefined || !e.tags.name) continue;
    const n = e.tags.name;
    const pos = { lat, lng: lon };
    if (stations.some((s) => s.n === n && distanceM(s, pos) < 120)) continue;
    stations.push({ n, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lon * 1e5) / 1e5, lines: list.filter((l) => distToSegmentsM(pos, l.segments) <= 140).map((l) => l.ref) });
  }
  if (!list.length || !stations.length) return null;
  return { at, lines: list, stations };
}

/** Estación más cercana en línea recta. */
export function nearestStation(stations: MetroStation[], p: LatLng): { s: MetroStation; d: number } | null {
  let best: { s: MetroStation; d: number } | null = null;
  for (const s of stations) {
    const d = distanceM(p, s);
    if (!best || d < best.d) best = { s, d };
  }
  return best;
}

/** «Barberini (A) · 350 m, unos 5 min a pie». Las calles dan más rodeo que la línea recta. */
export function metroText(near: { s: MetroStation; d: number }): { name: string; lines: string; meters: number; minutes: number } {
  const meters = Math.round((near.d * 1.3) / 10) * 10;
  return { name: near.s.n, lines: near.s.lines.join(' · '), meters, minutes: Math.max(1, Math.round(meters / 80)) };
}

// ── Copia en el móvil + descarga ────────────────────────────────
let mem: MetroData | null | undefined;
const listeners = new Set<() => void>();
const publish = (d: MetroData | null) => { mem = d; listeners.forEach((l) => l()); };

export async function cachedMetro(): Promise<MetroData | null> {
  if (mem !== undefined) return mem;
  const stored = (await getMeta<MetroData>(KEY)) ?? null;
  mem = stored;
  return stored;
}

export async function downloadMetro(fetchOverpass: (q: string) => Promise<{ elements?: El[] }>): Promise<MetroData> {
  const data = parseMetro(await fetchOverpass(metroQuery()));
  if (!data) throw new Error('Sin datos del metro');
  await setMeta(KEY, data);
  publish(data);
  return data;
}

export function useMetro(): MetroData | null {
  const [d, setD] = useState<MetroData | null>(mem ?? null);
  useEffect(() => {
    let alive = true;
    const on = () => { if (alive) setD(mem ?? null); };
    listeners.add(on);
    void cachedMetro().then((c) => { if (alive) setD(c); });
    return () => { alive = false; listeners.delete(on); };
  }, []);
  return d;
}
