import { Icon } from '@/components/Icon';
import type { LatLng } from '@/lib/geo';
import { metroText, nearestStation, useMetro } from '@/lib/metro-map';
import type { Profile } from '@/lib/relief';
import { findSaved, toggleSaved, useSaved, type SavedInput } from '@/lib/saved';
import { useWiki } from '@/lib/wiki';

/** ☆ / ★: guarda el sitio para los dos (se sincroniza con la pareja y funciona sin conexión). */
export function StarButton({ p }: { p: SavedInput }) {
  const list = useSaved();
  const on = !!findSaved(list, p);
  return (
    <button type="button" class={`btn${on ? ' primary' : ''}`} aria-pressed={on} onClick={() => void toggleSaved(list, p)}>
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? 'Guardado' : 'Guardar'}
    </button>
  );
}

/** «Metro Barberini (línea A) a unos 5 min a pie». Solo si hay una estación razonablemente cerca. */
export function MetroNear({ p }: { p: LatLng }) {
  const metro = useMetro();
  const near = metro ? nearestStation(metro.stations, p) : null;
  if (!near || near.d > 1400) return null;
  const t = metroText(near);
  const lines = near.s.lines;
  return (
    <p class="small">
      <Icon name="train" size={16} /> Metro <b>{t.name}</b>{lines.length ? ` (${lines.length > 1 ? 'líneas' : 'línea'} ${lines.join(' y ')})` : ''} · a unos <span class="num">{t.minutes} min</span> a pie <span class="muted num">({t.meters} m)</span>
    </p>
  );
}

/** Foto y resumen de Wikipedia del sitio (si lo hay), con su atribución. */
export function WikiBlock({ placeId }: { placeId: string }) {
  const { info, photo } = useWiki(placeId);
  if (!info || (!photo && !info.extract)) return null;
  return (
    <div class="wikirow">
      {photo && <img src={photo} alt={info.title ?? ''} width="96" height="96" />}
      <div class="stack" style={{ gap: '0.2rem' }}>
        {info.extract && <p class="small wikitext">{info.extract}</p>}
        <p class="small muted">Foto y texto: <a href={info.url} target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)</p>
      </div>
    </div>
  );
}

/** Desnivel de una ruta: cuánto sube y baja, y el perfil dibujado. */
export function ElevationChart({ p }: { p: Profile | null | undefined }) {
  if (!p || p.pts.length < 2) return null;
  const lo = p.min, hi = Math.max(p.max, lo + 10);
  const W = 200, H = 40;
  const xy = p.pts.map((v, i) => `${((i / (p.pts.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - lo) / (hi - lo)) * (H - 8)).toFixed(1)}`);
  const flat = p.ascent + p.descent < 6;
  return (
    <div class="elev" role="img" aria-label={flat ? 'Ruta llana' : `Sube ${p.ascent} metros y baja ${p.descent}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,${H} ${xy.join(' ')} ${W},${H}`} class="elev-fill" />
        <polyline points={xy.join(' ')} class="elev-line" />
      </svg>
      <span class="small num">{flat ? 'Ruta llana' : <>↑ {p.ascent} m · ↓ {p.descent} m</>} <span class="muted">· entre {p.min} y {p.max} m</span></span>
    </div>
  );
}
