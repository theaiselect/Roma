import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RomaMap, type MapPin } from '@/components/RomaMap';
import { Icon } from '@/components/Icon';
import { PlaceFacts } from '@/components/StopCard';
import { placeById, places } from '@/data/places';
import { days } from '@/data/trip';
import type { DayNum, Place } from '@/data/types';
import { useNow } from '@/lib/clock';
import { getMeta, setMeta, useKind, type Entity } from '@/lib/db';
import { distanceM, formatDistance, geoHelp, locate, walkingDistanceM, watchPosition, type LatLng } from '@/lib/geo';
import { ARRIVED_M, advance, bearing, distanceToStep, isOffRoute, remainingM, spoken } from '@/lib/nav';
import { canSpeak, keepAwake, speak, stopSpeaking } from '@/lib/speech';
import { directionsUrl, isIOS } from '@/lib/maps';
import { useTimeline } from '@/lib/plan-state';
import { romeParts } from '@/lib/time';
import { downloadRoma, estimateMB, mapDownloadInfo, type MapDownload } from '@/lib/offline-map';
import { cachedPois, footRoute, footRouteVia, formatDuration, geocodeCached, nearest, refreshPois, reverseGeocode, searchPlaces, type Found, type Poi, type PoiKind, type Route } from '@/lib/osm';

const DAY_COLOR: Record<DayNum, string> = { 1: 'var(--terracotta)', 2: 'var(--ocra)', 3: 'var(--pino)', 4: 'var(--vino)', 5: 'var(--tinta-suave)' };
// Los mapas no entienden variables CSS: mismos colores en hexadecimal.
const DAY_HEX: Record<DayNum, string> = { 1: '#C0583A', 2: '#D9A441', 3: '#4E6B4A', 4: '#7A2E3A', 5: '#5E544E' };

interface Pin { id: string; lat: number; lng: number; day: DayNum | 0; label: string; short?: string; place?: Place; heart?: boolean }

const W = 360;
const H = 420;
const PAD = 18;

function project(pins: LatLng[]): (p: LatLng) => { x: number; y: number } {
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const sx = (W - 2 * PAD) / ((maxLng - minLng) * k || 1);
  const sy = (H - 2 * PAD) / (maxLat - minLat || 1);
  const s = Math.min(sx, sy);
  const offX = (W - (maxLng - minLng) * k * s) / 2;
  const offY = (H - (maxLat - minLat) * s) / 2;
  return (p) => ({ x: offX + (p.lng - minLng) * k * s, y: H - (offY + (p.lat - minLat) * s) });
}

/** Mapa esquemático sin conexión (F18 en versión ligera): posiciones reales de las paradas, sin calles. */
function Schematic({ pins, me, onPick, labels }: { pins: Pin[]; me: LatLng | null; onPick: (p: Pin) => void; labels: boolean }) {
  const all = me ? [...pins, me] : pins;
  if (!pins.length) return null;
  const proj = project(all);
  // Escala: 500 m
  const a = proj({ lat: 41.89, lng: 12.47 });
  const b = proj({ lat: 41.89, lng: 12.47 + 500 / (111_320 * Math.cos(41.89 * Math.PI / 180)) });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="schematic" role="img" aria-label="Mapa esquemático de las paradas">
      {pins.map((p) => {
        const { x, y } = proj(p);
        return p.heart ? (
          <text key={p.id} x={x} y={y + 5} text-anchor="middle" style={{ fontSize: '16px', fill: 'var(--terracotta)' }} onClick={() => onPick(p)}>♥</text>
        ) : (
          <g key={p.id} role="button" tabIndex={0} aria-label={p.label} onClick={() => onPick(p)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(p); }} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r="11" fill="transparent" />
            <circle cx={x} cy={y} r="6" fill={p.day ? DAY_COLOR[p.day as DayNum] : 'var(--tinta)'} stroke="var(--tarjeta)" stroke-width="1.5" />
            {labels && <text x={x + 9} y={y + 4}>{p.short}</text>}
          </g>
        );
      })}
      {me && (() => { const { x, y } = proj(me); return <g><circle cx={x} cy={y} r="12" fill="#4A7FA8" opacity="0.2" /><circle cx={x} cy={y} r="6" fill="#4A7FA8" stroke="#fff" stroke-width="2" /></g>; })()}
      <line x1={PAD} y1={H - 10} x2={PAD + (b.x - a.x)} y2={H - 10} stroke="var(--tinta-suave)" stroke-width="2" />
      <text x={PAD} y={H - 14}>500 m</text>
      <text x={W - PAD} y={PAD} text-anchor="end">N ↑</text>
    </svg>
  );
}


type Filter = 'food' | 'gelato' | 'cafe' | 'pharmacy' | 'fountain' | 'toilets';
const FILTERS: [Filter, string][] = [['food', 'Comida'], ['gelato', 'Helado'], ['cafe', 'Café'], ['pharmacy', 'Farmacia'], ['fountain', 'Fuente'], ['toilets', 'Baño']];
const OSM_KIND: Partial<Record<Filter, PoiKind>> = { gelato: 'gelato', cafe: 'cafe', pharmacy: 'pharmacy', fountain: 'fountain', toilets: 'toilets' };
const POI_HEX: Record<Filter, string> = { food: '#C0583A', gelato: '#C25B85', cafe: '#8A6A4B', pharmacy: '#3E8E5A', fountain: '#4A7FA8', toilets: '#6B6560' };

interface NearItem { id: string; name: string; d: number; lat: number; lng: number; place?: Place; poi?: Poi; extra?: string }

/** Lo que hay cerca para el filtro: sitios del documento + puntos de OpenStreetMap, ordenados por distancia. */
function nearItems(f: Filter, from: LatLng, pois: Poi[]): NearItem[] {
  const out: NearItem[] = places
    .filter((p) => p.kind === f && p.lat !== undefined && p.lng !== undefined)
    .map((p) => ({ id: p.id, name: p.name, d: walkingDistanceM(from, { lat: p.lat!, lng: p.lng! }), lat: p.lat!, lng: p.lng!, place: p }));
  const k = OSM_KIND[f];
  if (k) {
    for (const { poi, d } of nearest(pois, k, from, 15)) {
      // Si el documento ya trae ese sitio (mismo punto), no se repite.
      if (out.some((o) => distanceM(o, poi) < 40)) continue;
      out.push({ id: `osm:${poi.id}`, name: poi.name, d: d * 1.3, lat: poi.lat, lng: poi.lng, poi, extra: poi.note });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, 15);
}

function useOnline(): boolean {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false);
    window.addEventListener('online', u); window.addEventListener('offline', d);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', d); };
  }, []);
  return on;
}

/** Mapa sin conexión: descarga Roma entera (estilo, iconos, letras y teselas hasta el zoom 14). */
function OfflineMapCard() {
  const [info, setInfo] = useState<MapDownload | undefined>();
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const online = useOnline();
  useEffect(() => { void mapDownloadInfo().then(setInfo); }, []);
  const go = async () => {
    setErr(null); setProg([0, 1]);
    try { setInfo(await downloadRoma((d, t) => setProg([d, t]))); }
    catch { setErr('No se ha podido descargar. Prueba con wifi o con más cobertura.'); }
    setProg(null);
  };
  return (
    <section class="card stack" style={{ gap: '0.5rem' }}>
      <h2>Mapa sin conexión</h2>
      {info
        ? <p class="small"><span class="chip ok">Descargado</span> {info.tiles.toLocaleString('es-ES')} teselas · {(info.bytes / 1048576).toFixed(0)} MB · {new Date(info.at).toLocaleDateString('es-ES')}. El mapa de Roma funciona sin datos.</p>
        : <p class="small">Descarga Roma una vez con wifi (unos {estimateMB()} MB) y el mapa funcionará sin datos ni cobertura. La ruta a pie y el buscador sí necesitan conexión.</p>}
      {prog && <progress value={prog[0]} max={prog[1]} aria-label="Descargando" style={{ width: '100%' }} />}
      {err && <p class="small pending">{err}</p>}
      <button type="button" class="btn primary" disabled={!!prog || !online} onClick={() => void go()}>
        <Icon name="map" /> {prog ? `Descargando ${Math.round((prog[0] / prog[1]) * 100)} %` : info ? 'Actualizar descarga' : 'Descargar Roma'}
      </button>
      {!online && <p class="small muted">Sin conexión ahora mismo.</p>}
    </section>
  );
}

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Sitios del plan que coinciden con lo escrito. Funcionan sin conexión. */
function localMatches(q: string): Found[] {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  return places.filter((p) => p.lat !== undefined && p.lng !== undefined && norm(p.name).includes(n)).slice(0, 4)
    .map((p) => ({ id: `local:${p.id}`, name: p.name, detail: 'En vuestro plan', lat: p.lat!, lng: p.lng! }));
}

type Picked = { kind: 'stop'; pin: Pin } | { kind: 'heart'; pin: Pin } | { kind: 'poi'; item: NearItem; filter: Filter } | { kind: 'found'; found: Found } | { kind: 'hotel' };

export function MapScreen() {
  const now = useNow(60_000);
  const tl = useTimeline();
  const online = useOnline();
  const today = days.find((d) => d.date === romeParts(now).date);
  const [day, setDay] = useState<DayNum | 0>(today?.day ?? 0);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [filter, setFilter] = useState<Filter>(() => {
    const f = new URLSearchParams(location.search).get('f');
    return FILTERS.some(([k]) => k === f) ? (f as Filter) : 'food';
  });
  const [nearOnMap, setNearOnMap] = useState(() => new URLSearchParams(location.search).has('f'));
  const [pois, setPois] = useState<Poi[]>([]);
  const [poiAge, setPoiAge] = useState<number | null>(null);
  const [hotel, setHotel] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [follow, setFollow] = useState(false);
  const [stepIdx, setStepIdx] = useState(1);
  const [dest, setDest] = useState<(LatLng & { name: string }) | null>(null);
  const [voice, setVoice] = useState(false);
  const [dayRoute, setDayRoute] = useState<Pin[] | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const [recent, setRecent] = useState<Found[]>([]);
  const [focused, setFocused] = useState(false);
  const lastFix = useRef<LatLng | null>(null);
  const rerouteAt = useRef(0);
  const typing = useRef(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const memories = [...(useKind<Entity>('diary') ?? []), ...(useKind<Entity>('photo') ?? [])].filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number');

  useEffect(() => {
    void cachedPois().then((c) => { if (c) { setPois(c.pois); setPoiAge(c.at); } });
    void refreshPois().then((c) => { if (c) { setPois(c.pois); setPoiAge(c.at); } });
    void geocodeCached('hotel-soha', 'Via Zucchelli 32, Roma').then(setHotel);
    void getMeta<Found[]>('map-recent').then((r) => { if (r) setRecent(r); });
  }, []);

  // Navegación: sigue tu posición, mantiene la pantalla encendida y calcula el rumbo.
  useEffect(() => {
    if (!navigating) return;
    let gone = false;
    let release = () => {};
    void keepAwake().then((r) => { if (gone) r(); else release = r; });
    const stop = watchPosition((f) => {
      setMe(f.pos);
      setError(null);
      const prev = lastFix.current;
      let h = f.heading;
      if (h === null && prev && distanceM(prev, f.pos) > 6) h = bearing(prev, f.pos);
      if (!prev || distanceM(prev, f.pos) > 6) lastFix.current = f.pos;
      if (h !== null) setHeading(h);
    }, (r) => {
      // Un fallo suelto del GPS (calle estrecha, túnel) no corta la navegación: solo si niegas el permiso.
      if (r === 'denied' || r === 'unsupported') { setError(geoHelp(r, isIOS())); stopNav(); } else setError('Buscando señal de GPS…');
    });
    return () => { gone = true; stop(); release(); };
  }, [navigating]);

  // Cada vez que te mueves: ¿has llegado?, ¿toca la siguiente indicación?, ¿te has desviado?
  useEffect(() => {
    if (!navigating || !route || !me || !dest) return;
    if (distanceM(me, dest) < ARRIVED_M) { setArrived(dest.name); if (voice) speak('Has llegado'); stopNav(); return; }
    const i = advance(me, route.steps, stepIdx);
    if (i !== stepIdx) { setStepIdx(i); if (voice) speak(spoken(route.steps, i)); }
    if (isOffRoute(me, route.coords) && Date.now() - rerouteAt.current > 15_000) {
      rerouteAt.current = Date.now();
      void footRoute(me, dest).then((r) => { if (r) { setRoute(r); setStepIdx(1); if (voice) speak('Recalculando la ruta'); } });
    }
  }, [me?.lat, me?.lng, navigating]);

  const stopPins = useMemo(() => {
    const out: Pin[] = [];
    const seen = new Set<string>();
    for (const s of tl) {
      if (day && s.day !== day) continue;
      const p = s.placeId ? placeById.get(s.placeId) : undefined;
      if (!p || p.lat === undefined || p.lng === undefined || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, lat: p.lat, lng: p.lng, day: s.day, label: `${s.start ?? ''} ${s.title}`.trim(), short: s.start ?? '', place: p });
    }
    return out;
  }, [tl, day]);
  const heartPins: Pin[] = useMemo(() => memories.map((m) => ({ id: m.id, lat: m.lat as number, lng: m.lng as number, day: 0 as const, label: String(m.caption ?? m.text ?? 'Recuerdo'), heart: true })), [memories.length]);
  const pins = useMemo(() => [...stopPins, ...heartPins], [stopPins, heartPins]);

  const from: LatLng = me ?? hotel ?? ROME_CENTER_FALLBACK;
  const near = useMemo(() => nearItems(filter, from, pois), [filter, from.lat, from.lng, pois]);

  const mapPins: MapPin[] = useMemo(() => {
    const out: MapPin[] = stopPins.map((p) => ({ id: `stop:${p.id}`, lat: p.lat, lng: p.lng, kind: 'stop', color: DAY_HEX[p.day as DayNum], short: p.short ?? '', label: p.label }));
    for (const h of heartPins) out.push({ id: `heart:${h.id}`, lat: h.lat, lng: h.lng, kind: 'heart', color: '#C0583A', short: '', label: h.label });
    if (hotel) out.push({ id: 'hotel', lat: hotel.lat, lng: hotel.lng, kind: 'hotel', color: '#2B2522', short: 'H', label: 'Hotel' });
    if (nearOnMap) for (const n of near) out.push({ id: `poi:${n.id}`, lat: n.lat, lng: n.lng, kind: 'poi', color: POI_HEX[filter], short: '', label: n.name });
    if (picked?.kind === 'found') out.push({ id: `found:${picked.found.id}`, lat: picked.found.lat, lng: picked.found.lng, kind: 'found', color: '#4A7FA8', short: '', label: picked.found.name });
    return out;
  }, [stopPins, heartPins, hotel, nearOnMap, near, filter, picked]);

  const onPick = (id: string) => {
    const [k, ...rest] = id.split(':');
    const key = rest.join(':');
    clearRoute();
    if (k === 'stop') { const pin = stopPins.find((p) => p.id === key); if (pin) setPicked({ kind: 'stop', pin }); }
    else if (k === 'heart') { const pin = heartPins.find((p) => p.id === key); if (pin) setPicked({ kind: 'heart', pin }); }
    else if (k === 'poi') { const item = near.find((n) => n.id === key); if (item) setPicked({ kind: 'poi', item, filter }); }
    else if (id === 'hotel') setPicked({ kind: 'hotel' });
  };

  const doLocate = async () => {
    setLocating(true);
    const r = await locate();
    setLocating(false);
    if (r.ok) { setMe(r.pos); setError(null); } else setError(geoHelp(r.reason, isIOS()));
  };

  const target = (p: Picked): (LatLng & { name: string; place?: Place }) | null => {
    if (p.kind === 'stop' || p.kind === 'heart') return { lat: p.pin.lat, lng: p.pin.lng, name: p.pin.label, place: p.pin.place };
    if (p.kind === 'poi') return { lat: p.item.lat, lng: p.item.lng, name: p.item.name, place: p.item.place };
    if (p.kind === 'found') return { lat: p.found.lat, lng: p.found.lng, name: p.found.name };
    return hotel ? { ...hotel, name: 'Hotel Soha', place: placeById.get('hotel-soha') } : null;
  };

  const stopNav = () => { setNavigating(false); setFollow(false); stopSpeaking(); };
  const clearRoute = () => { setRoute(null); setDest(null); setDayRoute(null); setArrived(null); stopNav(); };

  const walkTo = async (t: LatLng & { name: string }) => {
    const origin = me ?? hotel;
    if (!origin) { setError('Pulsa «Dónde estoy» para trazar la ruta desde donde estás.'); return; }
    setRouting('Calculando…');
    const r = await footRoute(origin, t);
    setRouting(null);
    if (r) { setRoute(r); setDest(t); setDayRoute(null); setArrived(null); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); } else setError(online ? 'No se ha podido calcular la ruta. Usa «Abrir en Google Maps» para verla en el mapa del móvil.' : 'La ruta necesita conexión. Usa «Abrir en Google Maps» cuando tengas datos.');
  };

  /** Ruta que une todas las paradas del día, en orden, con el tiempo de cada tramo. */
  const planDay = async () => {
    if (stopPins.length < 2) return;
    setRouting('day');
    const r = await footRouteVia(stopPins.map((p) => ({ lat: p.lat, lng: p.lng })));
    setRouting(null);
    if (r) { setRoute(r); setDest(null); setDayRoute(stopPins); setPicked(null); stopNav(); setError(null); } else setError(online ? 'No se ha podido calcular la ruta del día.' : 'La ruta del día necesita conexión.');
  };

  const startNav = () => {
    if (!route || !dest) return;
    setArrived(null); setStepIdx(1); setFollow(true); setNavigating(true); lastFix.current = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (voice) speak(spoken(route.steps, 1));
  };

  const longPress = async (p: LatLng) => {
    clearRoute();
    const id = `pt${Date.now()}`;
    setPicked({ kind: 'found', found: { id, name: 'Punto marcado', detail: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`, ...p } });
    const f = await reverseGeocode(p);
    if (f) setPicked((cur) => (cur?.kind === 'found' && cur.found.id === id ? { kind: 'found', found: { ...f, id } } : cur));
  };

  const search = (text: string) => {
    setQ(text);
    window.clearTimeout(typing.current);
    const local = localMatches(text);
    if (text.trim().length < 2) { setResults(null); return; }
    setResults(local);
    if (text.trim().length < 3) return;
    typing.current = window.setTimeout(async () => {
      const far = await searchPlaces(text);
      const extra = (far ?? []).filter((f) => !local.some((l) => distanceM(l, f) < 40));
      setResults([...local, ...extra]);
    }, 280);
  };
  const chooseFound = (f: Found) => {
    setResults(null); setQ(f.name); setFocused(false); clearRoute();
    setPicked({ kind: 'found', found: f });
    setFocus({ lat: f.lat, lng: f.lng, key: Date.now() });
    const next = [f, ...recent.filter((r) => r.id !== f.id)].slice(0, 5);
    setRecent(next);
    void setMeta('map-recent', next);
  };

  const t = picked ? target(picked) : null;
  const originLabel = me ? 'desde donde estás' : hotel ? 'desde el hotel' : '';

  return (
    <div class="stack-lg">
      <div class="page-title"><h1>Mapa</h1></div>
      <div class="searchbox">
        <input type="search" value={q} placeholder="Buscar un sitio en Roma" aria-label="Buscar un sitio" onInput={(e) => search((e.target as HTMLInputElement).value)}
          onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 180)} />
        {results && (
          <ul class="results" role="listbox">
            {results.length === 0 && <li class="small muted" style={{ padding: '0.6rem 0.8rem' }}>{online ? 'Sin resultados.' : 'El buscador necesita conexión.'}</li>}
            {results.map((f) => <li key={f.id}><button type="button" role="option" onClick={() => chooseFound(f)}><b>{f.name}</b><span class="small muted">{f.detail}</span></button></li>)}
          </ul>
        )}
        {!results && focused && !q && recent.length > 0 && (
          <ul class="results">
            <li class="small muted" style={{ padding: '0.4rem 0.8rem 0' }}>Búsquedas recientes</li>
            {recent.map((f) => <li key={f.id}><button type="button" onClick={() => chooseFound(f)}><b>{f.name}</b><span class="small muted">{f.detail}</span></button></li>)}
          </ul>
        )}
      </div>
      <div class="legend" role="group" aria-label="Día">
        <button type="button" aria-pressed={day === 0} onClick={() => { setDay(0); clearRoute(); }}>Todos</button>
        {days.map((d) => <button type="button" key={d.day} aria-pressed={day === d.day} onClick={() => { setDay(d.day); clearRoute(); }}><i style={{ background: DAY_COLOR[d.day] }} />{d.roman}</button>)}
      </div>
      {day !== 0 && stopPins.length > 1 && !fallback && (
        <button type="button" class="btn" disabled={!!routing} onClick={() => void planDay()}><Icon name="walk" /> {routing === 'day' ? 'Calculando…' : 'Ruta a pie del día'}</button>
      )}
      {fallback ? (
        <>
          <div class="alert"><Icon name="alert" /><span>No se ha podido cargar el mapa{online ? '' : ' (sin conexión y sin Roma descargada)'}. Mientras tanto, esquema de las paradas.</span></div>
          <Schematic pins={pins} me={me} onPick={(p) => setPicked(p.heart ? { kind: 'heart', pin: p } : { kind: 'stop', pin: p })} labels={day !== 0} />
        </>
      ) : (
        <div class={`mapwrap${navigating ? ' navmode' : ''}`}>
          <RomaMap pins={mapPins} me={me} route={route} fitKey={`${day}|${nearOnMap ? filter : ''}`} focus={focus} heading={heading} follow={follow} onPick={onPick} onLongPress={(p) => void longPress(p)} onUserMove={() => setFollow(false)} onFail={() => setFallback(true)} />
          {navigating && route && me && route.steps[stepIdx] && (() => {
            const st = route.steps[stepIdx]!;
            const rest = remainingM(me, route.steps, stepIdx);
            return (
              <div class="navbanner" role="status" aria-live="polite">
                <div class="navmain"><b class="navtext">{st.text}</b><span class="navdist num">{formatDistance(distanceToStep(me, st))}</span></div>
                <div class="row spread">
                  <span class="small num">{formatDuration(rest / 1.25)} · {formatDistance(rest)} para llegar</span>
                  <span class="row" style={{ gap: '0.35rem' }}>
                    {canSpeak() && <button type="button" class="btn ghost" aria-pressed={voice} onClick={() => setVoice((v) => { if (v) stopSpeaking(); return !v; })}>{voice ? 'Voz activada' : 'Voz'}</button>}
                    <button type="button" class="btn ghost" onClick={stopNav}>Salir</button>
                  </span>
                </div>
              </div>
            );
          })()}
          {navigating && !follow && <button type="button" class="btn locate recenter" onClick={() => setFollow(true)}><Icon name="walk" /> Recentrar</button>}
          <button type="button" class="btn locate" onClick={() => void doLocate()} disabled={locating} aria-label="Dónde estoy"><Icon name="pin" /> {locating ? '…' : me ? 'Actualizar' : 'Dónde estoy'}</button>
        </div>
      )}
      {error && <div class="alert"><Icon name="alert" /><span>{error}</span></div>}
      {arrived && <div class="card row spread" role="status"><span><b>Has llegado</b> a {arrived}.</span><button type="button" class="btn ghost" onClick={() => { setArrived(null); clearRoute(); }}>Cerrar</button></div>}
      {route && (
        <section class="card stack" role="status" style={{ gap: '0.5rem' }}>
          <div class="row spread">
            <span><b class="num">{formatDuration(route.durationS)}</b> a pie · <span class="num">{formatDistance(route.distanceM)}</span>{dayRoute ? <span class="small muted"> · {dayRoute.length} paradas</span> : <span class="small muted"> {originLabel}</span>}</span>
            <button type="button" class="btn ghost" onClick={clearRoute}>Quitar ruta</button>
          </div>
          {dest && !navigating && <button type="button" class="btn primary" onClick={startNav}><Icon name="walk" /> Empezar a caminar</button>}
          {dayRoute && (
            <ol class="legs">
              {dayRoute.slice(0, -1).map((p, i) => (
                <li key={p.id}><span>{p.short} {p.place?.name ?? p.label}</span><span class="small muted num">→ {route.legs[i] ? `${formatDuration(route.legs[i]!.durationS)} · ${formatDistance(route.legs[i]!.distanceM)}` : ''}</span></li>
              ))}
              <li><span>{dayRoute[dayRoute.length - 1]!.short} {dayRoute[dayRoute.length - 1]!.place?.name ?? dayRoute[dayRoute.length - 1]!.label}</span></li>
            </ol>
          )}
          {!dayRoute && route.steps.length > 1 && (
            <details>
              <summary>Ver las {route.steps.length} indicaciones</summary>
              <ol class="steps">{route.steps.map((st, i) => <li key={i}>{st.text}{st.distanceM >= 10 && i < route.steps.length - 1 ? <span class="small muted num"> · {formatDistance(st.distanceM)}</span> : null}</li>)}</ol>
            </details>
          )}
        </section>
      )}
      {picked && (
        <section class="card current stack" style={{ gap: '0.35rem' }}>
          <div class="spread"><b>{picked.kind === 'stop' || picked.kind === 'heart' ? picked.pin.label : picked.kind === 'poi' ? picked.item.name : picked.kind === 'found' ? picked.found.name : 'Hotel Soha Piazza di Spagna'}</b><button type="button" class="btn ghost" onClick={() => { setPicked(null); clearRoute(); }}>Cerrar</button></div>
          {picked.kind === 'found' && picked.found.detail && <p class="small muted">{picked.found.detail}</p>}
          {picked.kind === 'poi' && picked.item.extra && <p class="small muted">{picked.item.extra}</p>}
          {picked.kind === 'poi' && picked.item.poi && <p class="small muted">Dato de OpenStreetMap.</p>}
          {t?.place && <PlaceFacts place={t.place} />}
          {t && <p class="small muted">{me ? `A ${formatDistance(distanceM(me, t) * 1.3)} a pie.` : ''}</p>}
          {t && (
            <div class="stop-actions">
              <button type="button" class="btn primary" disabled={!!routing} onClick={() => void walkTo(t)}><Icon name="walk" /> {routing ? 'Calculando…' : 'Ruta a pie'}</button>
              <a class="btn" href={directionsUrl({ name: t.name, lat: t.lat, lng: t.lng })} target="_blank" rel="noopener"><Icon name="pin" /> Abrir en {isIOS() ? 'Apple Maps' : 'Google Maps'}</a>
              {t.place?.phone && <a class="btn" href={`tel:${t.place.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" /> Llamar</a>}
            </div>
          )}
        </section>
      )}
      <NearMe filter={filter} setFilter={(f) => { setFilter(f); setNearOnMap(true); setPicked(null); }} items={near} originLabel={originLabel || 'desde el centro de Roma'} onLocate={() => void doLocate()} locating={locating} hasMe={!!me}
        onShow={(n) => { setNearOnMap(true); setFocus({ lat: n.lat, lng: n.lng, key: Date.now() }); setPicked({ kind: 'poi', item: n, filter }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} poiAge={poiAge} />
      <OfflineMapCard />
      <p class="small muted">Mapa © OpenStreetMap y OpenFreeMap. Rutas: routing.openstreetmap.de. Buscador: Photon.</p>
    </div>
  );
}

const ROME_CENTER_FALLBACK: LatLng = { lat: 41.9028, lng: 12.4964 };

/** Cerca de mí (F20): sitios del documento y de OpenStreetMap, ordenados por distancia. */
function NearMe({ filter, setFilter, items, originLabel, onLocate, locating, hasMe, onShow, poiAge }: {
  filter: Filter; setFilter: (f: Filter) => void; items: NearItem[]; originLabel: string; onLocate: () => void; locating: boolean; hasMe: boolean; onShow: (n: NearItem) => void; poiAge: number | null;
}) {
  return (
    <section class="stack" aria-labelledby="near-title">
      <div class="spread">
        <h2 id="near-title">Cerca de mí</h2>
        {!hasMe && <button type="button" class="btn" onClick={onLocate} disabled={locating}><Icon name="pin" /> {locating ? 'Buscando…' : 'Dónde estoy'}</button>}
      </div>
      <div class="legend" role="group" aria-label="Filtro">
        {FILTERS.map(([k, l]) => <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}><i style={{ background: POI_HEX[k] }} />{l}</button>)}
      </div>
      {filter === 'fountain' && <p class="small">Los <b>nasoni</b> son fuentes de hierro con un caño curvo: si tapas la salida con el dedo, el agua sale por un agujero y se bebe como en un surtidor. El agua es potable.</p>}
      {filter === 'pharmacy' && <p class="small muted">Las farmacias tienen una cruz verde luminosa. Por la noche, la de guardia aparece en un cartel en la puerta de cualquiera.</p>}
      {filter === 'toilets' && <p class="small muted">Los baños públicos son pocos y a veces de pago. En un café, consumir algo suele bastar para usarlo.</p>}
      {items.length === 0 && <p class="small muted">{OSM_KIND[filter] && poiAge === null ? 'Descargando los puntos de OpenStreetMap… necesitan conexión la primera vez.' : 'No hay nada de esto en la lista.'}</p>}
      {items.map((n) => (
        <article key={n.id} class="card stack" style={{ gap: '0.3rem' }}>
          <div class="spread"><b>{n.name}</b><span class="chip num">{formatDistance(n.d)}</span></div>
          {n.extra && <p class="small muted">{n.extra}</p>}
          {n.place && <PlaceFacts place={n.place} />}
          <div class="stop-actions">
            <button type="button" class="btn" onClick={() => onShow(n)}><Icon name="map" /> Ver en el mapa</button>
            <a class="btn" href={directionsUrl({ name: n.name, lat: n.lat, lng: n.lng })} target="_blank" rel="noopener"><Icon name="walk" /> Cómo llegar</a>
          </div>
        </article>
      ))}
      <p class="small muted">Distancias a pie estimadas {originLabel}.{poiAge ? ` Datos de OpenStreetMap guardados el ${new Date(poiAge).toLocaleDateString('es-ES')}.` : ''}</p>
    </section>
  );
}
