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

import { fetchGraph, fetchPlaces, GRAPH_VERSION, overpass, type OfflinePack } from '@/lib/offline-data';
import { packGraph } from '@/lib/graph';
import { metroQuery, parseMetro } from '@/lib/metro-map';
import { EXTRA_GEO, overpassQuery, parseOverpass, searchPlaces } from '@/lib/osm';

const log = (t: string) => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${t}\n`); };
const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const t0 = Date.now();
  const r = await fn();
  log(`${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r;
};

it('prepara el paquete sin conexión', async () => {
  const [graph, places, poisRaw, metroRaw] = await Promise.all([
    timed('calles', () => fetchGraph()),
    timed('sitios', () => fetchPlaces()),
    timed('puntos', () => overpass<Parameters<typeof parseOverpass>[0]>(overpassQuery(), 90_000)),
    timed('metro', () => overpass<Parameters<typeof parseMetro>[0]>(metroQuery(), 90_000)),
  ]);
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
