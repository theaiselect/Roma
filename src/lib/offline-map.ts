// Mapa sin conexión: guarda en la caché del navegador ('mapa') las teselas de Roma, el estilo, los iconos y las letras.
// El service worker sirve esa misma caché cuando MapLibre las pide (ver sw.ts).
import { getMeta, setMeta } from '@/lib/db';
import { DOWNLOAD_BBOX, STYLE_URL } from '@/lib/osm';

export const MAP_CACHE = 'mapa';
export const MAX_TILE_ZOOM = 14; // OpenFreeMap no publica teselas vectoriales por encima del 14 (se amplían solas)

export interface Tile { z: number; x: number; y: number }

export function lngToX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
export function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Teselas que cubren el rectángulo, de un zoom a otro. */
export function tilesForBbox(b: { west: number; south: number; east: number; north: number }, minZ: number, maxZ: number): Tile[] {
  const out: Tile[] = [];
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = lngToX(b.west, z), x1 = lngToX(b.east, z);
    const y0 = latToY(b.north, z), y1 = latToY(b.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}

export const tileUrl = (tpl: string, t: Tile): string => tpl.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));

interface StyleJson {
  glyphs?: string;
  sprite?: string;
  sources: Record<string, { type: string; url?: string; tiles?: string[] }>;
  layers: { layout?: { 'text-font'?: string[] } }[];
}
interface TileJson { tiles: string[] }

/** Nombres de pila de letras que usa el estilo, tal como los pide MapLibre («Noto Sans Regular,Noto Sans Bold»). */
export function fontStacks(style: StyleJson): string[] {
  const set = new Set<string>();
  for (const l of style.layers) {
    const f = l.layout?.['text-font'];
    if (Array.isArray(f) && f.length) set.add(f.join(','));
  }
  return [...set];
}

export function extraUrls(style: StyleJson): string[] {
  const out: string[] = [];
  if (style.sprite) for (const s of ['.json', '.png', '@2x.json', '@2x.png']) out.push(`${style.sprite}${s}`);
  if (style.glyphs) for (const stack of fontStacks(style)) for (const range of ['0-255', '256-511']) out.push(style.glyphs.replace('{fontstack}', stack).replace('{range}', range));
  return out;
}

export interface MapDownload {
  at: number; tiles: number; bytes: number;
  /** Teselas que tocaba bajar (para saber si la descarga quedó completa). */
  total?: number;
  /** Plantilla de teselas de la versión descargada (OpenFreeMap cambia de versión cada semana). */
  tpl?: string;
  /** Dirección del TileJSON que se dejó fijado en la caché. */
  tileJsonUrl?: string;
}
const KEY = 'map-download';
export const mapDownloadInfo = () => getMeta<MapDownload>(KEY);

export function estimateMB(): number {
  return Math.round(tilesForBbox(DOWNLOAD_BBOX, 0, MAX_TILE_ZOOM).length * 0.05);
}

/** Una tesela que no llega en este tiempo se da por fallida (y se reintenta al final): un corte no deja la descarga colgada. */
const TILE_TIMEOUT_MS = 20_000;
/** Peticiones a la vez. OpenFreeMap va por HTTP/2, así que no penaliza pedir varias. */
const MAP_PARALLEL = 8;

async function put(cache: Cache, url: string): Promise<number> {
  if (await cache.match(url)) return 0;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TILE_TIMEOUT_MS);
  try { return await store(cache, url, await fetch(url, { signal: ctl.signal })); } finally { clearTimeout(t); }
}

async function store(cache: Cache, url: string, res: Response): Promise<number> {
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const copy = res.clone();
  const size = (await copy.arrayBuffer()).byteLength;
  await cache.put(url, res);
  return size;
}

const jsonResponse = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } });

/**
 * ¿Lo descargado sirve para el mapa que se va a pintar? El estilo y el TileJSON quedan fijados en la caché
 * (el service worker no los cambia), así que basta con comprobar que el TileJSON guardado apunta a la misma
 * versión de teselas que se descargó.
 */
export async function mapIsCurrent(info: MapDownload | undefined): Promise<boolean> {
  if (!info?.tpl) return false; // descarga antigua, de antes de fijar la versión: se repite una vez
  if (!info.tileJsonUrl) return true;
  try {
    const hit = await (await caches.open(MAP_CACHE)).match(info.tileJsonUrl);
    if (!hit) return false;
    const tj = (await hit.json()) as TileJson;
    return tj.tiles?.[0] === info.tpl;
  } catch { return false; }
}

/** Descarga Roma entera para usarla sin conexión. Si faltan teselas, falla (y se reintenta) en vez de darla por buena. */
export async function downloadRoma(onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<MapDownload> {
  const cache = await caches.open(MAP_CACHE);
  // `cache: 'reload'`: el service worker deja pasar la petición a la red (normalmente sirve la versión fijada).
  const style = (await (await fetch(STYLE_URL, { cache: 'reload' })).json()) as StyleJson;
  const src = Object.values(style.sources).find((s) => s.type === 'vector');
  if (!src) throw new Error('El estilo no tiene teselas vectoriales');
  let tpl = src.tiles?.[0];
  let tj: TileJson | null = null;
  if (!tpl && src.url) {
    tj = (await (await fetch(src.url, { cache: 'reload' })).json()) as TileJson;
    tpl = tj.tiles?.[0];
  }
  if (!tpl) throw new Error('Sin plantilla de teselas');
  const tileUrls = tilesForBbox(DOWNLOAD_BBOX, 0, MAX_TILE_ZOOM).map((t) => tileUrl(tpl, t));
  const urls = [...extraUrls(style), ...tileUrls];
  let done = 0, ok = 0, bytes = 0;
  const failed: string[] = [];
  const runAll = async (list: string[], progress: boolean) => {
    let i = 0;
    const worker = async () => {
      while (i < list.length && !signal?.aborted) {
        const url = list[i++]!;
        try { bytes += await put(cache, url); ok++; } catch { failed.push(url); }
        if (progress) onProgress(++done, urls.length);
      }
    };
    await Promise.all(Array.from({ length: MAP_PARALLEL }, worker));
  };
  await runAll(urls, true);
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  // Segunda oportunidad para lo que falló (cortes de cobertura).
  if (failed.length) { const again = failed.splice(0); await runAll(again, false); }
  const tileSet = new Set(tileUrls);
  const missingTiles = failed.filter((u) => tileSet.has(u)).length;
  if (missingTiles > tileUrls.length * 0.02) throw new Error(`Faltan ${missingTiles} teselas de ${tileUrls.length}`);
  // Solo ahora se fija esta versión: el mapa pedirá justo las teselas que se acaban de guardar.
  await cache.put(STYLE_URL, jsonResponse(style));
  if (src.url && tj) await cache.put(src.url, jsonResponse(tj));
  // Las teselas de versiones anteriores ya no se van a pedir: fuera, para no ocupar espacio.
  const prefix = tpl.split('{z}')[0]!;
  for (const req of await cache.keys()) if (/\/planet\/[^?]+\.pbf/.test(req.url) && !req.url.startsWith(prefix)) await cache.delete(req);
  const info: MapDownload = { at: Date.now(), tiles: tileUrls.length - missingTiles, bytes, total: tileUrls.length, tpl, tileJsonUrl: src.url };
  await setMeta(KEY, info);
  void navigator.storage?.persist?.();
  return info;
}
