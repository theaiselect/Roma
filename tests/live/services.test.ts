// Prueba con internet REAL los servicios que usa la app, con las mismas URLs y consultas del código.
// No entra en las pruebas normales: npx vitest run --config vitest.live.config.ts
// Deja un informe en español en la consola y, en GitHub Actions, en el resumen del trabajo.
import 'fake-indexeddb/auto';
import { appendFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';

// La app corre en el navegador: `window` y `navigator.onLine` existen. Aquí se simulan.
Object.assign(globalThis, { window: globalThis });
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => true });
// Un navegador manda su User-Agent; Node manda «node», que Wikimedia y Overpass pueden rechazar.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has('user-agent')) headers.set('user-agent', 'RomaApp-live-check/1.0 (+https://github.com/theaiselect/Roma)');
  return nodeFetch(input, { ...init, headers });
};

import { distinctRoutes, EXTRA_GEO, footRoutes, footRouteVia, overpassQuery, parseOsrmAll, parseOverpass, parsePhoton, refreshPois, reverseGeocode, ROME_BBOX, searchPlaces, STYLE_URL } from '@/lib/osm';
import { OVERPASS_MIRRORS, overpass, parsePlaces, parseWays, placesQuery, splitBbox, wayQuery } from '@/lib/offline-data';
import { metroQuery, nearestStation, parseMetro } from '@/lib/metro-map';
import { fetchWiki, wikiPlaces, wikiUrl } from '@/lib/wiki';
import { FORECAST_URL, parseForecast } from '@/lib/weather';
import { places } from '@/data/places';

const ORIGIN = 'https://roma-rho-eight.vercel.app';
const rows: { area: string; check: string; ok: boolean; detail: string }[] = [];
const note = (area: string, check: string, ok: boolean, detail: string) => {
  rows.push({ area, check, ok, detail });
  console.log(`${ok ? '✅' : '❌'} [${area}] ${check}: ${detail}`);
};

/** Petición en bruto: estado, tiempo, si deja usarla desde la web de la app (CORS) y el cuerpo. */
async function raw(url: string, init: RequestInit = {}, ms = 60_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, headers: { Origin: ORIGIN, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(ms) });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, ms: Date.now() - t0, cors: res.headers.get('access-control-allow-origin'), type: res.headers.get('content-type') ?? '', body };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, cors: null, type: '', body: Buffer.from(String(e)) };
  }
}
const corsOk = (c: string | null) => c === '*' || c === ORIGIN;
const json = <T>(b: Buffer): T | null => { try { return JSON.parse(b.toString('utf8')) as T; } catch { return null; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PANTHEON = { lat: 41.8986, lng: 12.4768 }, COLOSSEO = { lat: 41.8903, lng: 12.4922 };
const TERMINI = { lat: 41.90083, lng: 12.50194 }, SPAGNA = { lat: 41.9061, lng: 12.4828 }, TREVI = { lat: 41.90083, lng: 12.48306 };
const HOTEL_APROX = { lat: 41.9026, lng: 12.4868 }; // Via Zucchelli, para el metro más cercano

describe('servicios reales', () => {
  it('OpenFreeMap: estilo, teselas, letras e iconos', async () => {
    const s = await raw(STYLE_URL);
    const style = json<{ layers?: { id: string }[]; sources?: { openmaptiles?: { url?: string } }; glyphs?: string; sprite?: string }>(s.body);
    note('OpenFreeMap', 'estilo positron', s.status === 200 && !!style?.layers?.length && corsOk(s.cors), `HTTP ${s.status}, ${style?.layers?.length ?? 0} capas, CORS ${s.cors}`);
    const fixture = (await import('../fixtures/ofm-positron-style.json')).default as { layers: { id: string; paint?: unknown; layout?: unknown }[] };
    const live = (style?.layers ?? []) as { id: string; paint?: unknown; layout?: unknown }[];
    const diff = fixture.layers.filter((f) => { const l = live.find((x) => x.id === f.id); return !l || JSON.stringify(l.paint) !== JSON.stringify(f.paint) || JSON.stringify(l.layout) !== JSON.stringify(f.layout); }).map((f) => f.id);
    const extra = live.filter((l) => !fixture.layers.some((f) => f.id === l.id)).map((l) => l.id);
    note('OpenFreeMap', 'estilo igual al de las pruebas del mapa oscuro', !diff.length && !extra.length, diff.length || extra.length ? `cambian: ${diff.join(', ') || '—'}; nuevas: ${extra.join(', ') || '—'}` : 'las 55 capas, colores y rótulos idénticos');

    const tjUrl = style?.sources?.openmaptiles?.url ?? '';
    const tj = await raw(tjUrl);
    const tiles = json<{ tiles?: string[] }>(tj.body)?.tiles?.[0] ?? '';
    note('OpenFreeMap', 'TileJSON', tj.status === 200 && !!tiles && corsOk(tj.cors), `HTTP ${tj.status}, ${tiles}`);
    // Tesela z14 del Panteón
    const n = 2 ** 14, x = Math.floor(((PANTHEON.lng + 180) / 360) * n);
    const lr = (PANTHEON.lat * Math.PI) / 180, y = Math.floor(((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2) * n);
    const tile = await raw(tiles.replace('{z}', '14').replace('{x}', String(x)).replace('{y}', String(y)));
    note('OpenFreeMap', 'tesela z14 del Panteón', tile.status === 200 && tile.body.length > 1000 && corsOk(tile.cors), `HTTP ${tile.status}, ${(tile.body.length / 1024).toFixed(0)} KB, ${tile.ms} ms`);
    const glyph = await raw((style?.glyphs ?? '').replace('{fontstack}', encodeURIComponent('Noto Sans Regular')).replace('{range}', '0-255'));
    note('OpenFreeMap', 'letras (Noto Sans Regular)', glyph.status === 200 && glyph.body.length > 1000, `HTTP ${glyph.status}, ${(glyph.body.length / 1024).toFixed(0)} KB`);
    const sprite = await raw(`${style?.sprite ?? ''}.json`);
    note('OpenFreeMap', 'iconos (sprite)', sprite.status === 200, `HTTP ${sprite.status}`);
  });

  it('OSRM a pie: ruta, alternativas y ruta del día', async () => {
    const alts = await footRoutes(COLOSSEO, PANTHEON);
    note('OSRM', 'Coliseo → Panteón con alternativas', alts.length > 0 && !alts[0]!.offline, alts.map((r) => `${(r.distanceM / 1000).toFixed(2)} km / ${Math.round(r.durationS / 60)} min / ${r.steps.length} pasos`).join(' · ') || 'sin ruta');
    if (alts[0]) note('OSRM', 'instrucciones en español (primeras)', alts[0].steps.length > 2, alts[0].steps.slice(0, 4).map((s) => JSON.stringify(s).slice(0, 90)).join(' | '));
    const day = await footRouteVia([TERMINI, SPAGNA, TREVI, PANTHEON]);
    note('OSRM', 'ruta del día Termini → Spagna → Trevi → Panteón', !!day && !day.offline && day.legs.length === 3, day ? `${(day.distanceM / 1000).toFixed(2)} km, tramos ${day.legs.map((l) => Math.round(l.distanceM)).join(' / ')} m` : 'sin ruta');
    const r = await raw(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${COLOSSEO.lng},${COLOSSEO.lat};${PANTHEON.lng},${PANTHEON.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`);
    note('OSRM', 'CORS para la web de la app', corsOk(r.cors), `CORS ${r.cors}, ${r.ms} ms, rutas en bruto ${parseOsrmAll(json(r.body)).length} → distintas ${distinctRoutes(parseOsrmAll(json(r.body))).length}`);
  });

  it('Photon: buscador, direcciones del hotel y el Pincio, y «qué hay aquí»', async () => {
    for (const q of ['Colosseo', 'Fontana di Trevi', 'Termini', 'Sant Eustachio']) {
      const f = await searchPlaces(q);
      note('Photon', `buscar «${q}»`, !!f?.length, f?.length ? f.slice(0, 3).map((x) => `${x.name} (${x.detail})`).join(' · ') : 'nada (o ha caído a lo guardado)');
      await sleep(400);
    }
    for (const [id, qs] of Object.entries(EXTRA_GEO)) {
      for (const q of qs) {
        const f = (await searchPlaces(q))?.[0];
        note('Photon', `coordenadas de ${id}: «${q}»`, !!f, f ? `${f.name} (${f.detail}) → ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : 'nada');
        await sleep(400);
      }
    }
    const rev = await reverseGeocode(TREVI);
    note('Photon', 'qué hay en la Fontana di Trevi (reverse)', !!rev, rev ? `${rev.name} (${rev.detail})` : 'nada');
    for (const lim of [1, 5]) {
      const rr = await raw(`https://photon.komoot.io/api/reverse?lat=${TREVI.lat}&lon=${TREVI.lng}&limit=${lim}`);
      const props = (json<{ features?: { properties: Record<string, unknown> }[] }>(rr.body)?.features ?? []).map((f) => JSON.stringify(f.properties).slice(0, 160));
      note('Photon', `reverse en bruto (limit=${lim}), diagnóstico`, true, `HTTP ${rr.status}: ${props.join(' / ') || rr.body.toString('utf8').slice(0, 160)}`);
    }
    const b = ROME_BBOX;
    const r = await raw(`https://photon.komoot.io/api/?q=Pantheon&limit=6&lat=41.9028&lon=12.4964&bbox=${b.west - 0.15},${b.south - 0.1},${b.east + 0.15},${b.north + 0.1}`);
    note('Photon', 'HTTP y CORS', r.status === 200 && corsOk(r.cors), `HTTP ${r.status}, CORS ${r.cors}, ${r.ms} ms, ${parsePhoton(json(r.body)).length} resultados`);
  });

  it('Overpass: espejos, fuentes/baños/farmacias, metro, sitios y calles', { timeout: 1_200_000 }, async () => {
    const CANDIDATES = [...OVERPASS_MIRRORS, 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.osm.jp/api/interpreter'];
    for (const m of CANDIDATES) for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await sleep(15_000);
      const r = await raw(m, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent('[out:json][timeout:25];node["amenity"="drinking_water"](41.895,12.47,41.90,12.48);out 5;')}` }, 90_000);
      const els = json<{ elements?: unknown[] }>(r.body)?.elements;
      if (!els && attempt < 3) { console.log(`… ${new URL(m).host} intento ${attempt}: HTTP ${r.status}`); continue; }
      note('Overpass', `espejo ${new URL(m).host} (intento ${attempt})`, r.status === 200 && !!els, `HTTP ${r.status}, ${els?.length ?? '—'} elementos, CORS ${r.cors}, ${r.ms} ms${r.status !== 200 ? `, «${r.body.toString('utf8').slice(0, 120).replace(/\s+/g, ' ')}»` : ''}`);
      break;
    }

    const pois = await refreshPois(true);
    const byKind = (pois?.pois ?? []).reduce<Record<string, number>>((a, p) => ({ ...a, [p.kind]: (a[p.kind] ?? 0) + 1 }), {});
    note('Overpass', 'fuentes, baños, farmacias, cafés y heladerías (consulta de la app)', (pois?.pois.length ?? 0) > 100, JSON.stringify(byKind));
    if (!pois) {
      const r = await raw('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(overpassQuery())}` }, 60_000);
      note('Overpass', 'puntos en bruto', false, `HTTP ${r.status}, ${parseOverpass(json(r.body)).length} puntos`);
    }

    try {
      const t0 = Date.now();
      const metro = parseMetro(await overpass(metroQuery(), 60_000));
      const lines = metro?.lines.map((l) => `${l.ref} (${l.segments.length} tramos)`).join(', ') ?? '—';
      note('Overpass', 'metro: líneas', !!metro && ['A', 'B', 'C'].every((r) => metro.lines.some((l) => l.ref === r)), `${lines}, ${Date.now() - t0} ms`);
      if (metro) {
        const noLine = metro.stations.filter((s) => !s.lines.length).map((s) => s.n);
        note('Overpass', 'metro: estaciones', metro.stations.length > 40, `${metro.stations.length} estaciones; sin línea asignada: ${noLine.length ? noLine.join(', ') : 'ninguna'}`);
        for (const [name, p] of [['hotel (Via Zucchelli)', HOTEL_APROX], ['Termini', TERMINI], ['Coliseo', COLOSSEO], ['San Pedro', { lat: 41.90222, lng: 12.45333 }]] as const) {
          const near = nearestStation(metro.stations, p);
          note('Overpass', `metro más cercano a ${name}`, !!near && near.d < 1500, near ? `${near.s.n} (línea ${near.s.lines.join('/') || '?'}) a ${Math.round(near.d)} m` : 'ninguna');
        }
      }
    } catch (e) { note('Overpass', 'metro', false, String(e)); }

    try {
      const part = splitBbox(ROME_BBOX, 2, 2)[0]!;
      const items = parsePlaces(await overpass(placesQuery(part)));
      note('Overpass', 'sitios para buscar sin conexión (1 de 4 trozos)', items.length > 50, `${items.length} sitios`);
    } catch (e) { note('Overpass', 'sitios para buscar sin conexión', false, String(e)); }

    try {
      const pad = 0.04;
      const area = { west: ROME_BBOX.west - pad, south: ROME_BBOX.south - pad, east: ROME_BBOX.east + pad, north: ROME_BBOX.north + pad };
      const center = splitBbox(area, 3, 3)[4]!; // el trozo del centro, el más pesado
      const t0 = Date.now();
      const ways = parseWays(await overpass(wayQuery(center)));
      note('Overpass', 'calles para rutas sin conexión (trozo central de 9)', ways.length > 1000, `${ways.length} calles, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) { note('Overpass', 'calles para rutas sin conexión', false, String(e)); }
  });

  it('Wikipedia: foto y resumen de cada sitio', async () => {
    const all = wikiPlaces();
    let ok = 0;
    for (const p of all) {
      const w = await fetchWiki(p.id);
      const name = places.find((x) => x.id === p.id)?.name ?? p.id;
      const good = !!w && !w.none && !!w.extract;
      if (good) ok++;
      note('Wikipedia', name, good, !w ? 'sin respuesta' : w.none ? 'ningún artículo cercano encaja con la pista' : `«${w.title}» · ${w.extract ? 'resumen ✓' : 'SIN resumen'} · ${w.thumb ? `foto ${(w.thumb.size / 1024).toFixed(0)} KB` : 'sin foto'}`);
      if (w?.none) {
        const d = await raw(wikiUrl(p.lat, p.lng));
        const titles = (json<{ query?: { pages?: { title: string; index?: number }[] } }>(d.body)?.query?.pages ?? []).sort((a, b) => (a.index ?? 99) - (b.index ?? 99)).map((x) => x.title);
        note('Wikipedia', `${name}: artículos cercanos (diagnóstico)`, true, titles.join(' · '));
      }
      await sleep(250);
    }
    const r = await raw(wikiUrl(41.8903, 12.4922));
    const warn = json<{ warnings?: unknown }>(r.body)?.warnings;
    note('Wikipedia', 'HTTP, CORS y avisos de la API', r.status === 200 && corsOk(r.cors) && !warn, `HTTP ${r.status}, CORS ${r.cors}, avisos: ${warn ? JSON.stringify(warn).slice(0, 200) : 'ninguno'}`);
    note('Wikipedia', 'resumen', ok === all.length, `${ok} de ${all.length} sitios con artículo y resumen`);
  });

  it('Open-Meteo: previsión', async () => {
    const r = await raw(FORECAST_URL);
    const f = parseForecast(json(r.body));
    const trip = f?.days.filter((d) => d.date >= '2026-10-30' && d.date <= '2026-11-03') ?? [];
    note('Open-Meteo', 'previsión 16 días', r.status === 200 && !!f && corsOk(r.cors), `HTTP ${r.status}, CORS ${r.cors}, ${f?.days.length ?? 0} días; viaje: ${trip.map((d) => `${d.date.slice(5)} ${d.tmin}–${d.tmax}° lluvia ${d.rainProb ?? '?'}%`).join(' · ') || '—'}`);
  });

  afterAll(() => {
    const fails = rows.filter((r) => !r.ok).length;
    const md = [
      `## Servicios de la app con internet real — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      `${rows.length - fails} bien · ${fails} mal`, '',
      '| | Servicio | Comprobación | Detalle |', '|---|---|---|---|',
      ...rows.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.area} | ${r.check} | ${r.detail.replace(/\|/g, '/')} |`),
    ].join('\n');
    console.log(`\n${md}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  });

  it('no falla nada', () => {
    expect(rows.filter((r) => !r.ok).map((r) => `${r.area}: ${r.check}`)).toEqual([]);
  });
});
