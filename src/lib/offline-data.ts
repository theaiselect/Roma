// Todo lo que hace falta para usar Roma sin conexión: calles (rutas), sitios (buscador), mapa, tiempo y archivos.
import { db, getMeta, setMeta } from '@/lib/db';
import { liveBlobIds } from '@/lib/blob-refs';
import { distanceM, type LatLng } from '@/lib/geo';
import { buildGraph, fromStored, routeLeg, snap, toStored, type Graph, type OfflineLeg, type RawWay } from '@/lib/graph';
import { downloadRoma, mapDownloadInfo, mapIsCurrent, type MapDownload } from '@/lib/offline-map';
import { downloadMetro, cachedMetro } from '@/lib/metro-map';
import { extraGeo, EXTRA_GEO, refreshPois, resolveExtraGeo, ROME_BBOX, ROME_CENTER, type Found } from '@/lib/osm';
import { downloadRelief, reliefInfo } from '@/lib/relief';
import { ensureBlob } from '@/lib/sync';
import { forecastCached, refreshForecast } from '@/lib/weather';
import { downloadWiki, wikiStatus } from '@/lib/wiki';

// ── Overpass con espejos ────────────────────────────────────────
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function overpass<T>(query: string, timeoutMs = 90_000): Promise<T> {
  let last: unknown;
  for (const url of MIRRORS) {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}`, signal: ctl.signal });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`overpass ${res.status}`);
    } catch (e) { last = e; } finally { window.clearTimeout(t); }
  }
  throw last instanceof Error ? last : new Error('overpass');
}

type Bbox = { west: number; south: number; east: number; north: number };
/** Divide un rectángulo en cols×rows trozos para no pedir todo de golpe. */
export function splitBbox(b: Bbox, cols: number, rows: number): Bbox[] {
  const out: Bbox[] = [];
  const dx = (b.east - b.west) / cols, dy = (b.north - b.south) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    out.push({ west: b.west + i * dx, east: b.west + (i + 1) * dx, south: b.south + j * dy, north: b.south + (j + 1) * dy });
  }
  return out;
}

// ── Calles ──────────────────────────────────────────────────────
interface WayEl { type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }

export function parseWays(r: { elements?: WayEl[] } | null): RawWay[] {
  return (r?.elements ?? []).flatMap((e) => (e.type === 'way' && e.geometry && e.geometry.length > 1 && e.tags?.highway
    ? [{ hw: e.tags.highway, name: e.tags.name, pts: e.geometry.map((g) => [g.lat, g.lon] as [number, number]) }] : []));
}

export const wayQuery = (b: Bbox) => `[out:json][timeout:90];way["highway"]["highway"!~"^(motorway|motorway_link|proposed|construction|raceway|bus_guideway|corridor|elevator|platform|bridleway)$"]["foot"!~"^(no|private)$"]["access"!~"^(private|no)$"]["indoor"!="yes"](${b.south},${b.west},${b.north},${b.east});out tags geom qt;`;

const GRAPH_KEY = 'offline-graph';
const GRAPH_INFO = 'offline-graph-info';
/** v2: incluye las avenidas grandes («trunk», con acera en Roma) para no dar rodeos sin conexión. */
export const GRAPH_VERSION = 2;
export interface GraphInfo { at: number; nodes: number; streets: number; v?: number }

let graphMem: Graph | null | undefined;

export async function loadGraph(): Promise<Graph | null> {
  if (graphMem !== undefined) return graphMem;
  graphMem = fromStored(await getMeta(GRAPH_KEY));
  return graphMem;
}

export async function downloadGraph(onProgress: (done: number, total: number) => void): Promise<GraphInfo> {
  const pad = 0.02;
  const area = { west: ROME_BBOX.west - pad, south: ROME_BBOX.south - pad, east: ROME_BBOX.east + pad, north: ROME_BBOX.north + pad };
  const parts = splitBbox(area, 3, 3);
  const ways: RawWay[] = [];
  let done = 0;
  onProgress(0, parts.length);
  for (const p of parts) {
    ways.push(...parseWays(await overpass<{ elements?: WayEl[] }>(wayQuery(p))));
    onProgress(++done, parts.length);
  }
  const g = buildGraph(ways);
  if (g.n < 1000) throw new Error('Pocas calles descargadas');
  await setMeta(GRAPH_KEY, toStored(g));
  const info: GraphInfo = { at: Date.now(), nodes: g.n, streets: g.names.length, v: GRAPH_VERSION };
  await setMeta(GRAPH_INFO, info);
  graphMem = g;
  placeIdxMem = undefined;
  return info;
}

/** Ruta a pie con las calles guardadas (varios tramos si hay puntos intermedios). */
export async function offlineRoute(points: LatLng[]): Promise<{ distanceM: number; durationS: number; coords: [number, number][]; steps: OfflineLeg['steps']; legs: { distanceM: number; durationS: number }[] } | null> {
  const g = await loadGraph();
  if (!g || points.length < 2) return null;
  const legs: OfflineLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const l = routeLeg(g, points[i]!, points[i + 1]!);
    if (!l) return null;
    legs.push(l);
  }
  return {
    distanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    durationS: legs.reduce((s, l) => s + l.durationS, 0),
    coords: legs.flatMap((l) => l.coords),
    steps: legs.flatMap((l) => l.steps),
    legs: legs.map((l) => ({ distanceM: l.distanceM, durationS: l.durationS })),
  };
}

// ── Sitios ──────────────────────────────────────────────────────
export interface PlaceItem { n: string; lat: number; lng: number; k: string }
interface PlaceIdx { at: number; items: PlaceItem[] }
const PLACES_KEY = 'offline-places';
let placeIdxMem: { items: PlaceItem[]; streets: PlaceItem[] } | undefined;

interface PlaceEl { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const KIND_ES: Record<string, string> = {
  museum: 'Museo', attraction: 'Atracción', gallery: 'Galería', viewpoint: 'Mirador', hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Alojamiento', artwork: 'Obra de arte',
  restaurant: 'Restaurante', cafe: 'Cafetería', bar: 'Bar', pub: 'Pub', fast_food: 'Comida rápida', ice_cream: 'Heladería', pharmacy: 'Farmacia', hospital: 'Hospital', clinic: 'Clínica',
  police: 'Policía', toilets: 'Baño público', drinking_water: 'Fuente de agua', bank: 'Banco', atm: 'Cajero', place_of_worship: 'Iglesia o templo', theatre: 'Teatro', cinema: 'Cine',
  fountain: 'Fuente', marketplace: 'Mercado', bus_station: 'Estación de autobuses', taxi: 'Parada de taxi', station: 'Estación', subway_entrance: 'Metro', tram_stop: 'Tranvía',
  supermarket: 'Supermercado', convenience: 'Tienda', bakery: 'Panadería', park: 'Parque', garden: 'Jardín', square: 'Plaza', suburb: 'Barrio', neighbourhood: 'Barrio', quarter: 'Barrio',
};

export const placesQuery = (b: Bbox) => {
  const bb = `(${b.south},${b.west},${b.north},${b.east})`;
  return `[out:json][timeout:90];(
nwr["name"]["tourism"~"^(museum|attraction|gallery|viewpoint|hotel|hostel|guest_house|artwork)$"]${bb};
nwr["name"]["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|pharmacy|hospital|clinic|police|toilets|drinking_water|bank|place_of_worship|theatre|cinema|fountain|marketplace|bus_station)$"]${bb};
nwr["name"]["historic"]${bb};
nwr["name"]["railway"~"^(station|subway_entrance|tram_stop)$"]${bb};
nwr["name"]["shop"~"^(supermarket|bakery)$"]${bb};
nwr["name"]["leisure"~"^(park|garden)$"]${bb};
nwr["name"]["place"~"^(square|suburb|neighbourhood|quarter)$"]${bb};
);out center tags qt;`;
};

export function parsePlaces(r: { elements?: PlaceEl[] } | null): PlaceItem[] {
  const seen = new Set<string>();
  const out: PlaceItem[] = [];
  for (const e of r?.elements ?? []) {
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (!t?.name || lat === undefined || lng === undefined) continue;
    const raw = t.tourism ?? t.amenity ?? t.railway ?? t.shop ?? t.leisure ?? t.place ?? (t.historic ? 'historic' : '');
    const k = raw === 'historic' || (!KIND_ES[raw] && t.historic) ? 'Monumento' : (KIND_ES[raw] ?? '');
    const id = `${t.name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ n: t.name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, k });
  }
  return out;
}

export async function downloadPlaces(onProgress: (done: number, total: number) => void): Promise<number> {
  const parts = splitBbox(ROME_BBOX, 2, 2);
  const items: PlaceItem[] = [];
  let done = 0;
  onProgress(0, parts.length);
  for (const p of parts) {
    items.push(...parsePlaces(await overpass<{ elements?: PlaceEl[] }>(placesQuery(p))));
    onProgress(++done, parts.length);
  }
  if (items.length < 50) throw new Error('Pocos sitios descargados');
  await setMeta(PLACES_KEY, { at: Date.now(), items } satisfies PlaceIdx);
  placeIdxMem = undefined;
  return items.length;
}

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un nombre de calle por cada calle del grafo, con un punto de la misma (para buscar «Via del Corso»). */
export function streetItems(g: Graph): PlaceItem[] {
  const seen = new Set<number>();
  const out: PlaceItem[] = [];
  for (let a = 0; a < g.n; a++) {
    for (let e = g.off[a]!; e < g.off[a + 1]!; e++) {
      const nm = g.nm[e]!;
      if (nm < 0 || seen.has(nm)) continue;
      seen.add(nm);
      out.push({ n: g.names[nm]!, lat: g.lat[a]! / 1e6, lng: g.lng[a]! / 1e6, k: 'Calle' });
    }
  }
  return out;
}

async function loadPlaces(): Promise<{ items: PlaceItem[]; streets: PlaceItem[] }> {
  if (placeIdxMem) return placeIdxMem;
  const stored = await getMeta<PlaceIdx>(PLACES_KEY);
  const g = await loadGraph();
  placeIdxMem = { items: stored?.items ?? [], streets: g ? streetItems(g) : [] };
  return placeIdxMem;
}

/** Texto → hasta 6 sitios guardados. Todas las palabras tienen que aparecer; gana el que empieza por lo escrito. */
export function searchItems(items: PlaceItem[], q: string, from: LatLng = ROME_CENTER, limit = 6): Found[] {
  const toks = fold(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!toks.length) return [];
  const scored: { it: PlaceItem; s: number; d: number }[] = [];
  for (const it of items) {
    const n = fold(it.n);
    if (!toks.every((t) => n.includes(t))) continue;
    const words = n.split(/[^a-z0-9]+/);
    let s = 1;
    if (n.startsWith(toks[0]!)) s += 3;
    else if (words.some((w) => w.startsWith(toks[0]!))) s += 2;
    if (it.k !== 'Calle') s += 0.5;
    scored.push({ it, s, d: distanceM(from, it) });
  }
  scored.sort((a, b) => b.s - a.s || a.d - b.d);
  const seen = new Set<string>();
  const out: Found[] = [];
  for (const { it } of scored) {
    const id = `off:${it.n}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id: `${id}:${it.lat}`, name: it.n, detail: it.k || 'Sitio guardado', lat: it.lat, lng: it.lng });
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchOffline(q: string, from?: LatLng): Promise<Found[] | null> {
  const { items, streets } = await loadPlaces();
  if (!items.length && !streets.length) return null;
  return searchItems([...items, ...streets], q, from);
}

/** Qué hay en un punto: el sitio con nombre más cercano (≤ 40 m) o, si no, la calle más cercana (≤ 60 m). */
export function nearestItem(items: PlaceItem[], p: LatLng, maxM: number): PlaceItem | null {
  let best: PlaceItem | null = null, bd = maxM;
  for (const it of items) {
    if (Math.abs(it.lat - p.lat) > 0.0006 || Math.abs(it.lng - p.lng) > 0.0009) continue;
    const d = distanceM(p, it);
    if (d <= bd) { bd = d; best = it; }
  }
  return best;
}

export async function reverseOffline(p: LatLng): Promise<Found | null> {
  const { items } = await loadPlaces();
  const hit = nearestItem(items, p, 40);
  if (hit) return { id: `off:${hit.n}`, name: hit.n, detail: hit.k, lat: p.lat, lng: p.lng };
  const g = await loadGraph();
  const s = g && snap(g, p, 60);
  const nm = g && s ? g.nm[s.edge]! : -1;
  if (g && nm >= 0) return { id: `off:street:${nm}`, name: g.names[nm]!, detail: 'Calle (sin conexión)', lat: p.lat, lng: p.lng };
  return null;
}

// ── Archivos (entradas, fotos, tiques, audios) ──────────────────
export { blobIdsOf } from '@/lib/blob-refs';

/** Archivos imprescindibles que cita algún dato del viaje, y cuántos faltan en este móvil. */
export async function blobStatus(): Promise<{ total: number; missing: string[] }> {
  const d = await db();
  const ids = liveBlobIds(await d.getAll('entities'), true);
  const missing: string[] = [];
  for (const id of ids) if (!(await d.get('blobs', id))) missing.push(id);
  return { total: ids.size, missing };
}

export async function downloadBlobs(onProgress: (done: number, total: number) => void): Promise<{ ok: number; failed: number }> {
  const { missing } = await blobStatus();
  let ok = 0, failed = 0;
  onProgress(0, missing.length);
  for (const id of missing) {
    if (await ensureBlob(id).catch(() => false)) ok++; else failed++;
    onProgress(ok + failed, missing.length);
  }
  return { ok, failed };
}

// ── Estado y orquestación ───────────────────────────────────────
export interface OfflineStatus {
  map: (MapDownload & { current: boolean }) | undefined;
  graph: GraphInfo | undefined;
  places: { at: number; count: number } | undefined;
  pois: { at: number; count: number } | undefined;
  metro: { at: number; stations: number } | undefined;
  relief: { at: number } | undefined;
  photos: { at: number | undefined; have: number; total: number };
  weather: number | null;
  blobs: { total: number; missing: number };
  /** Sitios sin coordenadas en los datos (hotel, Pincio) ya localizados. */
  geo?: { have: number; total: number };
}

export async function offlineStatus(): Promise<OfflineStatus> {
  const [map, graph, pl, pois, b, metro, relief, photos] = await Promise.all([
    mapDownloadInfo(), getMeta<GraphInfo>(GRAPH_INFO), getMeta<PlaceIdx>(PLACES_KEY), getMeta<{ at: number; pois: unknown[] }>('osm-pois'), blobStatus(), cachedMetro(), reliefInfo(), wikiStatus(),
  ]);
  return {
    map: map ? { ...map, current: await mapIsCurrent(map) } : undefined, graph,
    places: pl ? { at: pl.at, count: pl.items.length } : undefined,
    pois: pois ? { at: pois.at, count: pois.pois.length } : undefined,
    metro: metro ? { at: metro.at, stations: metro.stations.length } : undefined,
    relief,
    photos,
    weather: forecastCached()?.fetchedAt ?? null,
    blobs: { total: b.total, missing: b.missing.length },
    geo: { have: Object.keys(await extraGeo()).length, total: Object.keys(EXTRA_GEO).length },
  };
}

export type Stage = 'map' | 'graph' | 'places' | 'pois' | 'metro' | 'relief' | 'photos' | 'weather' | 'files';
export const STAGE_LABEL: Record<Stage, string> = {
  map: 'Mapa de Roma', graph: 'Calles para rutas', places: 'Sitios para buscar', pois: 'Fuentes, baños y farmacias', metro: 'Metro', relief: 'Relieve (desnivel)',
  photos: 'Fotos de los sitios', weather: 'Tiempo', files: 'Entradas y fotos',
};

/** Lo descarga todo, etapa a etapa. Una etapa que falla no impide las demás; devuelve las que fallaron. */
export async function prepareOffline(onStage: (s: Stage, done: number, total: number) => void, signal?: AbortSignal, only?: readonly Stage[]): Promise<Stage[]> {
  const failed: Stage[] = [];
  const run = async (s: Stage, fn: () => Promise<unknown>) => {
    if (signal?.aborted || (only && !only.includes(s))) return;
    onStage(s, 0, 1);
    try { await fn(); } catch (e) { console.warn('offline', s, e); failed.push(s); }
  };
  await run('map', () => downloadRoma((d, t) => onStage('map', d, t), signal));
  await run('graph', () => downloadGraph((d, t) => onStage('graph', d, t)));
  await run('places', async () => {
    await downloadPlaces((d, t) => onStage('places', d, t));
    // El hotel y el Pincio no traen coordenadas en los datos: se buscan ahora y se guardan.
    const g = await resolveExtraGeo();
    if (g.have < g.total) throw new Error('Sin coordenadas del hotel');
  });
  await run('pois', async () => { if (!(await refreshPois(true))) throw new Error('pois'); });
  await run('metro', () => downloadMetro((q) => overpass(q, 60_000)));
  await run('relief', () => downloadRelief((d, t) => onStage('relief', d, t)));
  await run('photos', () => downloadWiki((d, t) => onStage('photos', d, t)));
  await run('weather', async () => { if (!(await refreshForecast())) throw new Error('weather'); });
  await run('files', async () => { const r = await downloadBlobs((d, t) => onStage('files', d, t)); if (r.failed) throw new Error('files'); });
  return failed;
}
