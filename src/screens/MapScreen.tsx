import { useMemo, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { PlaceActions, PlaceFacts } from '@/components/StopCard';
import { healthPlaces } from '@/data/health';
import { placeById, places } from '@/data/places';
import { days } from '@/data/trip';
import type { DayNum, Place } from '@/data/types';
import { useNow } from '@/lib/clock';
import { useKind, type Entity } from '@/lib/db';
import { distanceM, formatDistance, geoHelp, locate, walkingDistanceM, type LatLng } from '@/lib/geo';
import { directionsUrl, isIOS } from '@/lib/maps';
import { useTimeline } from '@/lib/plan-state';
import { romeParts } from '@/lib/time';

const DAY_COLOR: Record<DayNum, string> = { 1: 'var(--terracotta)', 2: 'var(--ocra)', 3: 'var(--pino)', 4: 'var(--vino)', 5: 'var(--tinta-suave)' };

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

type Filter = 'food' | 'gelato' | 'cafe' | 'pharmacy' | 'fountain';
const FILTERS: [Filter, string][] = [['food', 'Comida'], ['gelato', 'Helado'], ['cafe', 'Café'], ['pharmacy', 'Farmacia'], ['fountain', 'Fuente']];

/** Cerca de mí (F20): sitios ordenados por distancia. */
function NearMe({ me, onLocate, locating, error }: { me: LatLng | null; onLocate: () => void; locating: boolean; error: string | null }) {
  const [f, setF] = useState<Filter>('food');
  const list = places.filter((p) => p.kind === f && p.lat !== undefined && p.lng !== undefined)
    .map((p) => ({ p, d: me ? walkingDistanceM(me, { lat: p.lat!, lng: p.lng! }) : null }))
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  return (
    <section class="stack" aria-labelledby="near-title">
      <div class="spread">
        <h2 id="near-title">Cerca de mí</h2>
        <button type="button" class="btn" onClick={onLocate} disabled={locating}><Icon name="pin" /> {locating ? 'Buscando…' : me ? 'Actualizar' : 'Dónde estoy'}</button>
      </div>
      {error && <div class="alert"><Icon name="alert" /><span>{error}</span></div>}
      <div class="legend" role="group" aria-label="Filtro">
        {FILTERS.map(([k, l]) => <button type="button" key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
      </div>
      {f === 'pharmacy' && healthPlaces.filter((h) => h.kind === 'pharmacy').map((h) => (
        <article key={h.id} class="card stack" style={{ gap: '0.3rem' }}>
          <b>{h.name}</b><span class="small muted">{h.address}</span>
          <a class="btn" href={directionsUrl({ name: h.name, address: h.address })} target="_blank" rel="noopener"><Icon name="walk" /> Cómo llegar</a>
        </article>
      ))}
      {f === 'pharmacy' && <p class="small muted">Las farmacias tienen una cruz verde luminosa. Por la noche, la de guardia aparece en un cartel en la puerta de cualquiera.</p>}
      {f === 'fountain' && <p class="card small">No hay una lista verificada de fuentes en la app. Buscad los <b>nasoni</b>: fuentes de hierro con un caño curvo; si tapas el caño con el dedo, el agua sale por un agujerito para beber.</p>}
      {f === 'cafe' && <p class="small muted">No tenemos datos verificados de qué cafés tienen baño: en casi todos hay que consumir para usarlo.</p>}
      {list.map(({ p, d }) => (
        <article key={p.id} class="card stack" style={{ gap: '0.3rem' }}>
          <div class="spread"><b>{p.name}</b>{d !== null && <span class="chip num">{formatDistance(d)}</span>}</div>
          <PlaceFacts place={p} />
          <PlaceActions place={p} />
        </article>
      ))}
    </section>
  );
}

export function MapScreen() {
  const now = useNow(60_000);
  const tl = useTimeline();
  const today = days.find((d) => d.date === romeParts(now).date);
  const [day, setDay] = useState<DayNum | 0>(today?.day ?? 0);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Pin | null>(null);
  const memories = [...(useKind<Entity>('diary') ?? []), ...(useKind<Entity>('photo') ?? [])].filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number');

  const pins = useMemo(() => {
    const out: Pin[] = [];
    const seen = new Set<string>();
    for (const s of tl) {
      if (day && s.day !== day) continue;
      const p = s.placeId ? placeById.get(s.placeId) : undefined;
      if (!p || p.lat === undefined || p.lng === undefined || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, lat: p.lat, lng: p.lng, day: s.day, label: `${s.start ?? ''} ${s.title}`.trim(), short: s.start ?? '', place: p });
    }
    for (const m of memories) out.push({ id: m.id, lat: m.lat as number, lng: m.lng as number, day: 0, label: String(m.caption ?? m.text ?? 'Recuerdo'), heart: true });
    return out;
  }, [tl, day, memories.length]);

  const doLocate = async () => {
    setLocating(true);
    const r = await locate();
    setLocating(false);
    if (r.ok) { setMe(r.pos); setError(null); } else setError(geoHelp(r.reason, isIOS()));
  };

  return (
    <div class="stack-lg">
      <div class="page-title"><h1>Mapa</h1></div>
      <div class="legend" role="group" aria-label="Día">
        <button type="button" aria-pressed={day === 0} onClick={() => setDay(0)}>Todos</button>
        {days.map((d) => <button type="button" key={d.day} aria-pressed={day === d.day} onClick={() => setDay(d.day)}><i style={{ background: DAY_COLOR[d.day] }} />{d.roman}</button>)}
      </div>
      <Schematic pins={pins} me={me} onPick={setPicked} labels={day !== 0} />
      {picked && (
        <section class="card current stack" style={{ gap: '0.35rem' }}>
          <div class="spread"><b>{picked.label}</b><button type="button" class="btn ghost" onClick={() => setPicked(null)}>Cerrar</button></div>
          {picked.place && <><PlaceFacts place={picked.place} /><PlaceActions place={picked.place} /></>}
          {me && <p class="small muted">A {formatDistance(distanceM(me, picked) * 1.3)} a pie.</p>}
        </section>
      )}
      <p class="small muted">Mapa esquemático: muestra dónde está cada parada, sin calles. Para ir a un sitio, «Cómo llegar» abre {isIOS() ? 'Apple Maps' : 'Google Maps'}.</p>
      <NearMe me={me} onLocate={() => void doLocate()} locating={locating} error={error} />
    </div>
  );
}
