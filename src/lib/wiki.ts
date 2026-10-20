// Foto y resumen de cada sitio, de Wikipedia (CC BY-SA). Se busca el artículo por las coordenadas del sitio
// y se elige el que coincide con el nombre; todo se guarda en el móvil para verlo sin conexión.
import { useEffect, useState } from 'preact/hooks';
import { getMeta, setMeta } from '@/lib/db';
import { places } from '@/data/places';

/** Palabras del título del artículo (sin tildes, en minúsculas) que identifican cada sitio. */
export const WIKI_HINT: Record<string, RegExp> = {
  'villa-borghese': /^villa borghese/,
  'piazza-popolo': /plaza del popolo|piazza del popolo/,
  'piazza-spagna': /plaza de espana|piazza di spagna|escalinata de la trinidad/,
  'trevi': /fontana de trevi|fontana di trevi/,
  'colosseo': /^coliseo( de roma)?$|anfiteatro flavio/,
  'palatino': /^(monte )?palatino$|colina palatina/,
  'foro-romano': /^foro romano/,
  'ghetto': /gueto (judio )?de roma|ghetto (ebraico )?di roma/,
  'teatro-marcello': /teatro de marcelo|teatro di marcello/,
  'bocca-verita': /boca de la verdad|bocca della verita/,
  'circo-massimo': /circo maximo|circo massimo/,
  'aventino': /aventino/,
  'palazzo-barberini': /palacio barberini|palazzo barberini/,
  'castel-santangelo': /castillo de sant'?angelo|castel sant'?angelo|mausoleo de adriano/,
  'gianicolo': /janiculo|gianicolo/,
  'tempietto': /tempietto|san pietro in montorio/,
  'trastevere': /^trastevere/,
  'musei-vaticani': /museos vaticanos|capilla sixtina/,
  'san-pietro': /basilica de san pedro|basilica di san pietro/,
  'cupola': /basilica de san pedro|basilica di san pietro/,
  'navona': /plaza navona|piazza navona/,
  'pantheon': /^panteon( de agripa| de roma| \(roma\))?$/,
  'vittoriano': /monumento a victor manuel|vittoriano|altar de la patria/,
  'campidoglio': /plaza del (campidoglio|capitolio)|piazza del campidoglio|^capitolio|monte capitolino/,
  'termini': /estacion de roma termini|roma termini/,
  'musei-capitolini': /museos capitolinos/,
  'san-luigi': /luigi dei francesi|san luis de los franceses/,
  'sant-ignazio': /iglesia de san ignacio|sant'?ignazio/,
  'san-pietro-vincoli': /vincoli|vinculos/,
};

export interface WikiPage { title: string; extract?: string; index?: number; thumbnail?: { source: string; width?: number; height?: number }; fullurl?: string }
export interface WikiInfo { at: number; none?: boolean; title?: string; extract?: string; url?: string; thumb?: Blob }

export const fold = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Elige entre los artículos cercanos el primero (el más próximo) cuyo título encaja con el sitio. */
export function pickWiki(pages: WikiPage[], hint: RegExp): WikiPage | null {
  const sorted = [...pages].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  return sorted.find((p) => hint.test(fold(p.title))) ?? null;
}

export function wikiUrl(lat: number, lng: number): string {
  return `https://es.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=600&ggslimit=30&prop=pageimages%7Cextracts&piprop=thumbnail&pithumbsize=640&exintro=1&explaintext=1&exsentences=3&exlimit=30&format=json&formatversion=2&origin=*`;
}

export const articleUrl = (title: string): string => `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

async function getJson<T>(url: string, ms = 9000): Promise<T | null> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } finally { window.clearTimeout(t); }
}

// «wiki2»: pistas afinadas (antes algún sitio salía con el artículo de al lado): se vuelven a buscar.
const KEY = (id: string) => `wiki2:${id}`;
const MAX_AGE = 60 * 86_400_000;
const MISS_AGE = 14 * 86_400_000;

export const wikiPlaces = (): { id: string; lat: number; lng: number }[] =>
  places.flatMap((p) => (WIKI_HINT[p.id] && p.lat !== undefined && p.lng !== undefined ? [{ id: p.id, lat: p.lat, lng: p.lng }] : []));

export async function cachedWiki(id: string): Promise<WikiInfo | undefined> {
  return getMeta<WikiInfo>(KEY(id));
}

/** Descarga (y guarda) la ficha de un sitio. Devuelve null si no hay red; `none` si Wikipedia no tiene artículo que encaje. */
export async function fetchWiki(id: string): Promise<WikiInfo | null> {
  const p = wikiPlaces().find((x) => x.id === id);
  const hint = WIKI_HINT[id];
  if (!p || !hint) return null;
  const r = await getJson<{ query?: { pages?: WikiPage[] } }>(wikiUrl(p.lat, p.lng));
  if (!r) return null;
  const page = pickWiki(r.query?.pages ?? [], hint);
  if (!page) { const miss: WikiInfo = { at: Date.now(), none: true }; await setMeta(KEY(id), miss); return miss; }
  let thumb: Blob | undefined;
  if (page.thumbnail?.source) {
    try { const res = await fetch(page.thumbnail.source); if (res.ok) thumb = await res.blob(); } catch { /* sin foto: se queda el texto */ }
  }
  const info: WikiInfo = { at: Date.now(), title: page.title, extract: page.extract?.trim() || undefined, url: articleUrl(page.title), thumb };
  await setMeta(KEY(id), info);
  return info;
}

export const wikiFresh = (w: WikiInfo | undefined, now = Date.now()): boolean => !!w && now - w.at < (w.none ? MISS_AGE : MAX_AGE);

/** Fichas que faltan o están viejas. */
export async function wikiStatus(): Promise<{ total: number; have: number; at: number | undefined }> {
  const all = wikiPlaces();
  let have = 0, at: number | undefined;
  for (const p of all) { const w = await cachedWiki(p.id); if (wikiFresh(w)) { have++; at = Math.min(at ?? Infinity, w!.at); } }
  return { total: all.length, have, at };
}

export async function downloadWiki(onProgress: (done: number, total: number) => void): Promise<void> {
  const all = wikiPlaces();
  let done = 0, fails = 0;
  onProgress(0, all.length);
  const queue = [...all];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      if (!wikiFresh(await cachedWiki(p.id))) { const w = await fetchWiki(p.id).catch(() => null); if (!w) fails++; }
      onProgress(++done, all.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (fails > all.length / 2) throw new Error('Wikipedia no responde');
}

/** Ficha de un sitio: lo guardado al momento y, si falta y hay red, se descarga. */
export function useWiki(id: string | undefined): { info: WikiInfo | null; photo: string | null } {
  const [info, setInfo] = useState<WikiInfo | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!id || !WIKI_HINT[id]) return;
    let alive = true;
    void (async () => {
      let w = await cachedWiki(id);
      if (alive && w) setInfo(w);
      if (!wikiFresh(w) && navigator.onLine) { w = (await fetchWiki(id).catch(() => null)) ?? w; if (alive && w) setInfo(w); }
    })();
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    if (!info?.thumb) { setPhoto(null); return; }
    const u = URL.createObjectURL(info.thumb);
    setPhoto(u);
    return () => URL.revokeObjectURL(u);
  }, [info]);
  return { info: info && !info.none ? info : null, photo };
}
