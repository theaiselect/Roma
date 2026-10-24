// Descarga de Overpass (y Photon) lo que la app necesita sin conexión y lo deja en public/offline/roma.json,
// que la app sirve desde su propio dominio: así el móvil no espera a Overpass, que suele ir saturado.
// No entra en las pruebas normales: npx vitest run --config vitest.pack.config.ts
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';

Object.assign(globalThis, { window: globalThis });
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => true });
const nodeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has('user-agent')) headers.set('user-agent', 'RomaApp-pack/1.0 (+https://github.com/theaiselect/Roma)');
  return nodeFetch(input, { ...init, headers });
};

import { graphArea, GRAPH_VERSION, mirrorOrder, overpassRace, parsePlaces, parseWays, placesQuery, splitBbox, wayQuery, type OfflinePack } from '@/lib/offline-data';
import { buildGraph, packGraph } from '@/lib/graph';
import { metroQuery, parseMetro } from '@/lib/metro-map';
import { EXTRA_GEO, overpassQuery, parseOverpass, ROME_BBOX, searchPlaces } from '@/lib/osm';

const log = (t: string) => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${t}\n`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Aquí no hay prisa: trozos más pequeños, más tiempo por consulta, reintentos y pocas consultas a la vez.
async function ask<T>(name: string, query: string): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const t0 = Date.now();
    try {
      const { data, url } = await overpassRace<T>(query, mirrorOrder(null), 240_000, 30_000);
      log(`${name}: ${new URL(url).host}, ${((Date.now() - t0) / 1000).toFixed(1)} s${attempt > 1 ? ` (intento ${attempt})` : ''}`);
      return data;
    } catch (e) { last = e; console.log(`… ${name} intento ${attempt}: ${String(e)}`); await sleep(20_000 * attempt); }
  }
  throw last instanceof Error ? last : new Error(name);
}
async function each<A, B>(items: A[], n: number, fn: (a: A, i: number) => Promise<B>): Promise<B[]> {
  const out: B[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]!, k); } }));
  return out;
}
type Els = { elements?: never[] };

it('prepara el paquete sin conexión', async () => {
  const t0 = Date.now();
  const wayParts = splitBbox(graphArea(), 6, 6);
  const placeParts = splitBbox(ROME_BBOX, 3, 3);
  const [ways, placeChunks, poisRaw, metroRaw] = await Promise.all([
    each(wayParts, 2, (b, i) => ask<Els>(`calles ${i + 1}/${wayParts.length}`, wayQuery(b)).then(parseWays)),
    each(placeParts, 1, (b, i) => ask<Els>(`sitios ${i + 1}/${placeParts.length}`, placesQuery(b)).then(parsePlaces)),
    ask<Els>('puntos', overpassQuery()),
    ask<Els>('metro', metroQuery()),
  ]);
  log(`Overpass en total: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const graph = buildGraph(ways.flat());
  const seen = new Set<string>();
  const places = placeChunks.flat().filter((p) => { const k = `${p.n}|${p.lat}|${p.lng}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const pois = parseOverpass(poisRaw);
  const metro = parseMetro(metroRaw);
  const geo: NonNullable<OfflinePack['geo']> = {};
  for (const [id, queries] of Object.entries(EXTRA_GEO)) {
    for (const q of queries) { const f = (await searchPlaces(q))?.[0]; if (f) { geo[id] = { lat: f.lat, lng: f.lng }; break; } }
  }
  log(`${graph.n} cruces, ${places.length} sitios, ${pois.length} puntos, ${metro?.stations.length ?? 0} estaciones, ${Object.keys(geo).length} de ${Object.keys(EXTRA_GEO).length} direcciones`);
  expect(graph.n).toBeGreaterThan(1000);
  expect(places.length).toBeGreaterThan(50);
  expect(pois.length).toBeGreaterThan(100);
  expect(metro?.stations.length ?? 0).toBeGreaterThan(20);
  const pack: OfflinePack = { v: 1, at: Date.now(), graphV: GRAPH_VERSION, graph: packGraph(graph), places, pois, metro: metro!, geo };
  mkdirSync('public/offline', { recursive: true });
  const body = JSON.stringify(pack);
  writeFileSync('public/offline/roma.json', body);
  log(`public/offline/roma.json: ${(body.length / 1048576).toFixed(1)} MB`);
});
