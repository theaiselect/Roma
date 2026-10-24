// Calles de Roma en el móvil: grafo peatonal para calcular rutas a pie sin conexión.
// Se construye con los caminos de OpenStreetMap (Overpass) y se guarda en IndexedDB como arrays compactos.
import type { LatLng } from '@/lib/geo';
import { distanceM } from '@/lib/geo';
import { bearing, instruction, type Step } from '@/lib/nav';

export interface RawWay { hw: string; name?: string; pts: [number, number][] } // pts: [lat, lng]

export interface Graph {
  n: number;
  lat: Int32Array; // grados × 1e6
  lng: Int32Array;
  off: Int32Array; // CSR: aristas del nodo i = off[i]..off[i+1]
  to: Int32Array;
  len: Float32Array; // metros
  cls: Uint8Array; // 0 normal · 1 escaleras · 2 calle con tráfico · 3 servicio/pista
  nm: Int32Array; // índice en names (-1 sin nombre)
  names: string[];
}

const PEN = [1, 1.35, 1.12, 1.15];
const WALK_MS = 1.3; // 4,7 km/h

function classOf(hw: string): number {
  if (hw === 'steps') return 1;
  if (hw === 'trunk' || hw === 'trunk_link' || hw === 'primary' || hw === 'secondary' || hw === 'primary_link' || hw === 'secondary_link') return 2;
  if (hw === 'service' || hw === 'track') return 3;
  return 0;
}

const E6 = 1e6;
const key = (lat: number, lng: number) => Math.round(lat * E6) * 100_000_000 + Math.round(lng * E6);

/** Construye el grafo. Los nodos se unen por coordenada exacta (en OSM los nodos compartidos tienen la misma). */
export function buildGraph(ways: RawWay[]): Graph {
  const ids = new Map<number, number>();
  const la: number[] = [], lo: number[] = [];
  const idOf = (lat: number, lng: number): number => {
    const k = key(lat, lng);
    let id = ids.get(k);
    if (id === undefined) { id = la.length; ids.set(k, id); la.push(Math.round(lat * E6)); lo.push(Math.round(lng * E6)); }
    return id;
  };
  const names: string[] = [];
  const nameIdx = new Map<string, number>();
  const ea: number[] = [], eb: number[] = [], ec: number[] = [], en: number[] = [];
  for (const w of ways) {
    if (w.pts.length < 2) continue;
    let nm = -1;
    if (w.name) { nm = nameIdx.get(w.name) ?? -1; if (nm < 0) { nm = names.length; names.push(w.name); nameIdx.set(w.name, nm); } }
    const cls = classOf(w.hw);
    let prev = idOf(w.pts[0]![0], w.pts[0]![1]);
    for (let i = 1; i < w.pts.length; i++) {
      const cur = idOf(w.pts[i]![0], w.pts[i]![1]);
      if (cur !== prev) { ea.push(prev); eb.push(cur); ec.push(cls); en.push(nm); }
      prev = cur;
    }
  }
  const n = la.length;
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < ea.length; i++) { deg[ea[i]! + 1]!++; deg[eb[i]! + 1]!++; }
  for (let i = 0; i < n; i++) deg[i + 1]! += deg[i]!;
  const off = deg;
  const fill = new Int32Array(n);
  const m = off[n]!;
  const to = new Int32Array(m), len = new Float32Array(m), cls = new Uint8Array(m), nm = new Int32Array(m);
  const put = (a: number, b: number, c: number, name: number) => {
    const p = off[a]! + fill[a]!++;
    to[p] = b; cls[p] = c; nm[p] = name;
    len[p] = distanceM({ lat: la[a]! / E6, lng: lo[a]! / E6 }, { lat: la[b]! / E6, lng: lo[b]! / E6 });
  };
  for (let i = 0; i < ea.length; i++) { put(ea[i]!, eb[i]!, ec[i]!, en[i]!); put(eb[i]!, ea[i]!, ec[i]!, en[i]!); }
  return { n, lat: Int32Array.from(la), lng: Int32Array.from(lo), off, to, len, cls, nm, names };
}

const pt = (g: Graph, i: number): LatLng => ({ lat: g.lat[i]! / E6, lng: g.lng[i]! / E6 });

// ── Índice espacial de nodos (cuadrícula de ~110 m) ─────────────
const CELL = 0.001;
interface Grid { cells: Map<number, number[]> }
const gridCache = new WeakMap<Graph, Grid>();
const cellKey = (cx: number, cy: number) => cx * 100_000 + cy;
function gridOf(g: Graph): Grid {
  let gr = gridCache.get(g);
  if (gr) return gr;
  const cells = new Map<number, number[]>();
  for (let i = 0; i < g.n; i++) {
    const k = cellKey(Math.floor(g.lng[i]! / E6 / CELL), Math.floor(g.lat[i]! / E6 / CELL));
    const c = cells.get(k);
    if (c) c.push(i); else cells.set(k, [i]);
  }
  gr = { cells };
  gridCache.set(g, gr);
  return gr;
}

interface Snap { a: number; b: number; t: number; edge: number; at: LatLng; off: number } // off: metros desde el punto hasta la calle

/** Punto más cercano sobre una calle (proyección sobre el segmento). null si no hay calles a menos de maxM. */
export function snap(g: Graph, p: LatLng, maxM = 400): Snap | null {
  const gr = gridOf(g);
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_195;
  const cx = Math.floor(p.lng / CELL), cy = Math.floor(p.lat / CELL);
  let best = null as Snap | null;
  for (let r = 0; r <= 5; r++) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        for (const a of gr.cells.get(cellKey(x, y)) ?? []) {
          for (let e = g.off[a]!; e < g.off[a + 1]!; e++) {
            const b = g.to[e]!;
            const ax = g.lng[a]! / E6 * k, ay = g.lat[a]! / E6 * 111_195;
            const bx = g.lng[b]! / E6 * k, by = g.lat[b]! / E6 * 111_195;
            const px = p.lng * k, py = p.lat * 111_195;
            const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
            const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
            const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            if (!best || d < best.off) {
              best = { a, b, t, edge: e, off: d, at: { lat: (ay + t * dy) / 111_195, lng: (ax + t * dx) / k } };
            }
          }
        }
      }
    }
    // una vez hay un candidato, basta con mirar un anillo más (la cuadrícula es de ~110 m)
    if (best && best.off < (r + 0.5) * CELL * 111_195 * 0.9) break;
  }
  return best && best.off <= maxM ? best : null;
}

// ── A* con orígenes y destinos múltiples ────────────────────────
class Heap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const { k, v } = this; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p]! <= key) break; k[i] = k[p]!; v[i] = v[p]!; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const { k, v } = this; const rk = k[0]!, rv = v[0]!; const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1]! < k[c]!) c++;
        if (k[c]! >= lk) break;
        k[i] = k[c]!; v[i] = v[c]!; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return [rk, rv];
  }
}

const cost = (g: Graph, e: number) => g.len[e]! * PEN[g.cls[e]!]!;

function edgeBetween(g: Graph, a: number, b: number): number {
  let best = -1;
  for (let e = g.off[a]!; e < g.off[a + 1]!; e++) if (g.to[e] === b && (best < 0 || g.len[e]! < g.len[best]!)) best = e;
  return best;
}

/** Camino de nodos entre dos puntos ya ajustados a la calle. */
function shortestNodes(g: Graph, s: Snap, d: Snap): number[] | null {
  const dist = new Float64Array(g.n).fill(Infinity);
  const prev = new Int32Array(g.n).fill(-1);
  const done = new Uint8Array(g.n);
  const heap = new Heap();
  const eLen = g.len[s.edge]!;
  const h = (i: number) => distanceM(pt(g, i), d.at);
  const seed = (n: number, c: number) => { if (c < dist[n]!) { dist[n] = c; prev[n] = -1; heap.push(c + h(n), n); } };
  seed(s.a, s.t * eLen * PEN[g.cls[s.edge]!]!);
  seed(s.b, (1 - s.t) * eLen * PEN[g.cls[s.edge]!]!);
  const dLen = g.len[d.edge]!, dPen = PEN[g.cls[d.edge]!]!;
  const tail = new Map<number, number>([[d.a, d.t * dLen * dPen], [d.b, (1 - d.t) * dLen * dPen]]);
  let bestTotal = Infinity, bestEnd = -1;
  while (heap.size) {
    const [f, u] = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (f >= bestTotal) break;
    const t = tail.get(u);
    if (t !== undefined && dist[u]! + t < bestTotal) { bestTotal = dist[u]! + t; bestEnd = u; }
    for (let e = g.off[u]!; e < g.off[u + 1]!; e++) {
      const v = g.to[e]!;
      if (done[v]) continue;
      const nd = dist[u]! + cost(g, e);
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; heap.push(nd + h(v), v); }
    }
  }
  if (bestEnd < 0) return null;
  const path: number[] = [];
  for (let c = bestEnd; c !== -1; c = prev[c]!) path.push(c);
  return path.reverse();
}

// ── Pasos: instrucciones a partir de los giros ──────────────────
interface Seg { from: LatLng; to: LatLng; name?: string; len: number }

function turnType(angle: number): { type: string; modifier: string } {
  const a = Math.abs(angle);
  if (a >= 170) return { type: 'turn', modifier: 'uturn' };
  const side = angle > 0 ? 'right' : 'left';
  if (a < 20) return { type: 'continue', modifier: 'straight' };
  if (a < 60) return { type: 'turn', modifier: `slight ${side}` };
  if (a < 125) return { type: 'turn', modifier: side };
  return { type: 'turn', modifier: `sharp ${side}` };
}

const norm180 = (d: number) => ((d + 540) % 360) - 180;

/** Convierte una línea con nombres de calle en maniobras (salida, giros, llegada). */
export function stepsFromSegs(segs: Seg[]): { steps: Step[]; total: number } {
  const cum: number[] = [0];
  for (const s of segs) cum.push(cum[cum.length - 1]! + s.len);
  const total = cum[cum.length - 1]!;
  const man: { i: number; angle: number; name?: string; newName: boolean }[] = [];
  for (let i = 1; i < segs.length; i++) {
    // rumbos medidos al menos 15 m antes y después, para no confundir una curva con un giro
    let bi = i - 1, acc = 0;
    while (bi > 0 && acc < 15) { acc += segs[bi]!.len; bi--; }
    let fi = i, accF = 0;
    while (fi < segs.length - 1 && accF < 15) { accF += segs[fi]!.len; fi++; }
    const angle = norm180(bearing(segs[i]!.from, segs[fi]!.to) - bearing(segs[bi]!.from, segs[i - 1]!.to));
    const newName = !!segs[i]!.name && segs[i]!.name !== segs[i - 1]!.name;
    const a = Math.abs(angle);
    if (a >= 40 || (newName && a >= 22)) man.push({ i, angle, name: segs[i]!.name, newName });
  }
  // una curva suave da varios giros seguidos: nos quedamos con el más fuerte de cada racimo (< 25 m)
  const merged: typeof man = [];
  for (const m of man) {
    const last = merged[merged.length - 1];
    if (last && cum[m.i]! - cum[last.i]! < 25) { if (Math.abs(m.angle) > Math.abs(last.angle)) merged[merged.length - 1] = m; }
    else merged.push(m);
  }
  const steps: Step[] = [];
  const first = segs[0]!;
  steps.push({ text: instruction({ type: 'depart', location: [first.from.lng, first.from.lat] }, first.name), type: 'depart', at: [first.from.lng, first.from.lat], distanceM: 0 });
  for (const m of merged) {
    const p = segs[m.i]!.from;
    const { type, modifier } = turnType(m.angle);
    steps.push({ text: instruction({ type, modifier, location: [p.lng, p.lat] }, m.name), type, at: [p.lng, p.lat], distanceM: 0 });
  }
  const lastSeg = segs[segs.length - 1]!;
  steps.push({ text: instruction({ type: 'arrive', location: [lastSeg.to.lng, lastSeg.to.lat] }), type: 'arrive', at: [lastSeg.to.lng, lastSeg.to.lat], distanceM: 0 });
  // distanceM de cada paso = metros hasta el siguiente
  const pos = [0, ...merged.map((m) => cum[m.i]!), total];
  for (let j = 0; j < steps.length; j++) { steps[j]!.distanceM = Math.round((pos[j + 1] ?? pos[j]!) - pos[j]!); }
  steps[steps.length - 1]!.distanceM = 0;
  return { steps, total };
}

export interface OfflineLeg { distanceM: number; durationS: number; coords: [number, number][]; steps: Step[] }

/** Ruta a pie entre dos puntos usando solo el grafo guardado. null si no hay calles cerca o no hay camino. */
export function routeLeg(g: Graph, from: LatLng, to: LatLng): OfflineLeg | null {
  const s = snap(g, from), d = snap(g, to);
  if (!s || !d) return null;
  const sameEdge = (s.a === d.a && s.b === d.b) || (s.a === d.b && s.b === d.a);
  let nodes: number[] | null;
  if (sameEdge) nodes = [];
  else {
    nodes = shortestNodes(g, s, d);
    if (!nodes) return null;
  }
  // línea: punto de partida → calle → nodos → calle → destino
  const line: LatLng[] = [from, s.at, ...nodes.map((i) => pt(g, i)), d.at, to];
  const names: (string | undefined)[] = [undefined, g.nm[s.edge]! >= 0 ? g.names[g.nm[s.edge]!] : undefined];
  for (let i = 0; i < nodes.length - 1; i++) {
    const e = edgeBetween(g, nodes[i]!, nodes[i + 1]!);
    names.push(e >= 0 && g.nm[e]! >= 0 ? g.names[g.nm[e]!] : undefined);
  }
  if (nodes.length) names.push(g.nm[d.edge]! >= 0 ? g.names[g.nm[d.edge]!] : undefined);
  names.push(undefined);
  // segmentos con nombre; los primeros y últimos metros (hasta la calle) heredan el nombre vecino
  const segs: Seg[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const l = distanceM(line[i]!, line[i + 1]!);
    if (l < 0.5) continue;
    segs.push({ from: line[i]!, to: line[i + 1]!, name: names[i] ?? names[i + 1] ?? names[i - 1], len: l });
  }
  if (!segs.length) segs.push({ from, to, len: Math.max(distanceM(from, to), 1) });
  const { steps, total } = stepsFromSegs(segs);
  const coords: [number, number][] = line.map((p) => [p.lng, p.lat]);
  return { distanceM: Math.round(total), durationS: Math.round(total / WALK_MS), coords, steps };
}

// ── Guardado compacto ───────────────────────────────────────────
export interface StoredGraph { v: 1; n: number; lat: Int32Array; lng: Int32Array; off: Int32Array; to: Int32Array; len: Float32Array; cls: Uint8Array; nm: Int32Array; names: string[] }
export const toStored = (g: Graph): StoredGraph => ({ v: 1, ...g });
export const fromStored = (s: StoredGraph | undefined): Graph | null => (s && s.v === 1 && s.n > 0 ? s : null);

/** El grafo en JSON (para el paquete ya preparado que se sirve desde la propia app). */
export interface PackedGraph { n: number; lat: number[]; lng: number[]; off: number[]; to: number[]; len: number[]; cls: number[]; nm: number[]; names: string[] }
export const packGraph = (g: Graph): PackedGraph => ({
  n: g.n, lat: Array.from(g.lat), lng: Array.from(g.lng), off: Array.from(g.off), to: Array.from(g.to),
  len: Array.from(g.len, (x) => Math.round(x * 10) / 10), cls: Array.from(g.cls), nm: Array.from(g.nm), names: g.names,
});
export const unpackGraph = (p: PackedGraph): Graph => ({
  n: p.n, lat: Int32Array.from(p.lat), lng: Int32Array.from(p.lng), off: Int32Array.from(p.off), to: Int32Array.from(p.to),
  len: Float32Array.from(p.len), cls: Uint8Array.from(p.cls), nm: Int32Array.from(p.nm), names: p.names,
});
