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

export interface MapDownload { at: number; tiles: number; bytes: number }
const KEY = 'map-download';
export const mapDownloadInfo = () => getMeta<MapDownload>(KEY);

export function estimateMB(): number {
  return Math.round(tilesForBbox(DOWNLOAD_BBOX, 0, MAX_TILE_ZOOM).length * 0.05);
}

async function put(cache: Cache, url: string): Promise<number> {
  if (await cache.match(url)) return 0;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const copy = res.clone();
  const size = (await copy.arrayBuffer()).byteLength;
  await cache.put(url, res);
  return size;
}

/** Descarga Roma entera para usarla sin conexión. Devuelve cuántas teselas quedaron guardadas. */
export async function downloadRoma(onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<MapDownload> {
  const cache = await caches.open(MAP_CACHE);
  const style = (await (await fetch(STYLE_URL)).json()) as StyleJson;
  await cache.put(STYLE_URL, new Response(JSON.stringify(style), { headers: { 'content-type': 'application/json' } }));
  const src = Object.values(style.sources).find((s) => s.type === 'vector');
  if (!src) throw new Error('El estilo no tiene teselas vectoriales');
  let tpl = src.tiles?.[0];
  if (!tpl && src.url) {
    const tj = (await (await fetch(src.url)).json()) as TileJson;
    await cache.put(src.url, new Response(JSON.stringify(tj), { headers: { 'content-type': 'application/json' } }));
    tpl = tj.tiles[0];
  }
  if (!tpl) throw new Error('Sin plantilla de teselas');
  const urls = [...extraUrls(style), ...tilesForBbox(DOWNLOAD_BBOX, 0, MAX_TILE_ZOOM).map((t) => tileUrl(tpl, t))];
  let done = 0, ok = 0, bytes = 0, i = 0;
  const worker = async () => {
    while (i < urls.length && !signal?.aborted) {
      const url = urls[i++]!;
      try { bytes += await put(cache, url); ok++; } catch { /* una tesela que falle no tumba la descarga */ }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  const info = { at: Date.now(), tiles: ok, bytes };
  await setMeta(KEY, info);
  void navigator.storage?.persist?.();
  return info;
}
