// Relieve de Roma (altitudes) para el desnivel de cada ruta: una malla de ~250 m que se guarda en el móvil,
// así el desnivel se calcula sin conexión. Datos de Open-Meteo (Copernicus DEM, 90 m), sin clave.
import { getMeta, setMeta } from '@/lib/db';
import { distanceM, type LatLng } from '@/lib/geo';

export interface ReliefGrid { at: number; south: number; west: number; dLat: number; dLng: number; rows: number; cols: number; h: number[] }
export interface Profile { ascent: number; descent: number; min: number; max: number; distM: number; /** altitudes cada ~25 m, reducidas para dibujar */ pts: number[] }

export const RELIEF_BBOX = { west: 12.39, south: 41.83, east: 12.58, north: 41.96 } as const;
const STEP = { lat: 0.0022, lng: 0.003 };
const KEY = 'relief-grid';
export const RELIEF_MAX_AGE = 365 * 86_400_000;

export function gridShape(): { rows: number; cols: number } {
  return { rows: Math.floor((RELIEF_BBOX.north - RELIEF_BBOX.south) / STEP.lat) + 1, cols: Math.floor((RELIEF_BBOX.east - RELIEF_BBOX.west) / STEP.lng) + 1 };
}

/** Altitud (m) en un punto por interpolación entre las 4 celdas vecinas. null si cae fuera de la malla. */
export function gridElevation(g: ReliefGrid, lat: number, lng: number): number | null {
  const fy = (lat - g.south) / g.dLat, fx = (lng - g.west) / g.dLng;
  if (fy < 0 || fx < 0 || fy > g.rows - 1 || fx > g.cols - 1) return null;
  const y0 = Math.min(g.rows - 2, Math.floor(fy)), x0 = Math.min(g.cols - 2, Math.floor(fx));
  const ty = fy - y0, tx = fx - x0;
  const h = (y: number, x: number) => g.h[y * g.cols + x]!;
  const a = h(y0, x0) * (1 - tx) + h(y0, x0 + 1) * tx;
  const b = h(y0 + 1, x0) * (1 - tx) + h(y0 + 1, x0 + 1) * tx;
  return a * (1 - ty) + b * ty;
}

/** Puntos de la ruta cada `stepM` metros (incluye el final). Coordenadas GeoJSON [lng, lat]. */
export function sampleRoute(coords: [number, number][], stepM = 25): LatLng[] {
  if (!coords.length) return [];
  const out: LatLng[] = [{ lat: coords[0]![1], lng: coords[0]![0] }];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1]![1], lng: coords[i - 1]![0] }, b = { lat: coords[i]![1], lng: coords[i]![0] };
    const d = distanceM(a, b);
    let at = stepM - carry;
    while (at <= d) { const t = at / d; out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }); at += stepM; }
    carry = d - (at - stepM);
  }
  const last = { lat: coords[coords.length - 1]![1], lng: coords[coords.length - 1]![0] };
  if (distanceM(out[out.length - 1]!, last) > 1) out.push(last);
  return out;
}

/** Subidas y bajadas acumuladas. Se alisa un poco y se ignoran cambios de menos de 1 m para no sumar ruido. */
export function profileFrom(heights: number[], distM: number): Profile {
  const sm = heights.map((_, i) => { const w = heights.slice(Math.max(0, i - 1), i + 2); return w.reduce((s, x) => s + x, 0) / w.length; });
  let up = 0, down = 0, ref = sm[0] ?? 0;
  for (const h of sm) {
    if (h - ref >= 1) { up += h - ref; ref = h; } else if (ref - h >= 1) { down += ref - h; ref = h; }
  }
  const n = Math.min(48, sm.length);
  const pts = n ? Array.from({ length: n }, (_, i) => Math.round(sm[Math.round((i * (sm.length - 1)) / Math.max(1, n - 1))]!)) : [];
  return { ascent: Math.round(up), descent: Math.round(down), min: Math.round(Math.min(...sm)), max: Math.round(Math.max(...sm)), distM, pts };
}

let mem: ReliefGrid | null | undefined;
export async function loadRelief(): Promise<ReliefGrid | null> {
  if (mem !== undefined) return mem;
  mem = (await getMeta<ReliefGrid>(KEY)) ?? null;
  return mem;
}
export const reliefInfo = async (): Promise<{ at: number } | undefined> => { const g = await loadRelief(); return g ? { at: g.at } : undefined; };

const URL_BASE = 'https://api.open-meteo.com/v1/elevation';
async function elevations(points: LatLng[]): Promise<number[] | null> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 12_000);
  try {
    const qs = `latitude=${points.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${points.map((p) => p.lng.toFixed(5)).join(',')}`;
    const res = await fetch(`${URL_BASE}?${qs}`, { signal: ctl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { elevation?: number[] };
    return Array.isArray(j.elevation) && j.elevation.length === points.length ? j.elevation : null;
  } catch { return null; } finally { window.clearTimeout(t); }
}

/** Descarga la malla de altitudes de Roma (unas 30 peticiones pequeñas). */
export async function downloadRelief(onProgress: (done: number, total: number) => void): Promise<ReliefGrid> {
  const { rows, cols } = gridShape();
  const pts: LatLng[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) pts.push({ lat: RELIEF_BBOX.south + y * STEP.lat, lng: RELIEF_BBOX.west + x * STEP.lng });
  const chunks: LatLng[][] = [];
  for (let i = 0; i < pts.length; i += 100) chunks.push(pts.slice(i, i + 100));
  const h: number[] = [];
  onProgress(0, chunks.length);
  for (let i = 0; i < chunks.length; i++) {
    let got = await elevations(chunks[i]!);
    if (!got) { await new Promise((r) => window.setTimeout(r, 1200)); got = await elevations(chunks[i]!); }
    if (!got) throw new Error('Sin altitudes');
    h.push(...got.map((v) => Math.round(v)));
    onProgress(i + 1, chunks.length);
  }
  const grid: ReliefGrid = { at: Date.now(), south: RELIEF_BBOX.south, west: RELIEF_BBOX.west, dLat: STEP.lat, dLng: STEP.lng, rows, cols, h };
  await setMeta(KEY, grid);
  mem = grid;
  return grid;
}

/** Desnivel de una ruta: con la malla guardada (sin red) o, si aún no está, pidiéndolo en línea. */
export async function elevationProfile(coords: [number, number][]): Promise<Profile | null> {
  if (coords.length < 2) return null;
  const samples = sampleRoute(coords, 25);
  const distM = samples.reduce((s, p, i) => (i ? s + distanceM(samples[i - 1]!, p) : 0), 0);
  const g = await loadRelief();
  if (g) {
    const hs = samples.map((p) => gridElevation(g, p.lat, p.lng));
    if (hs.every((v) => v !== null)) return profileFrom(hs as number[], distM);
  }
  if (!navigator.onLine) return null;
  const sub = samples.length <= 100 ? samples : Array.from({ length: 100 }, (_, i) => samples[Math.round((i * (samples.length - 1)) / 99)]!);
  const hs = await elevations(sub);
  return hs ? profileFrom(hs, distM) : null;
}
