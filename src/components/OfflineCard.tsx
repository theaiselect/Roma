import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { offlineStatus, STAGE_LABEL, type OfflineStatus, type Stage } from '@/lib/offline-data';
import { activeStages, overallPct, runAuto, useAutoOffline, type AutoState } from '@/lib/auto-offline';
import { estimateMB } from '@/lib/offline-map';
import { travellers } from '@/data/trip';
import { useSettings } from '@/lib/settings';

function useOnline(): boolean {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false);
    window.addEventListener('online', u); window.addEventListener('offline', d);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', d); };
  }, []);
  return on;
}

const day = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

interface Row { stage: Stage; ok: boolean; text: string; need: string }

/** Qué hay ya en el móvil y para qué sirve. */
export function rows(s: OfflineStatus): Row[] {
  return [
    { stage: 'map', ok: !!s.map, text: s.map ? `${s.map.tiles.toLocaleString('es-ES')} teselas · ${(s.map.bytes / 1048576).toFixed(0)} MB · ${day(s.map.at)}` : `unos ${estimateMB()} MB`, need: 'ver el mapa' },
    { stage: 'graph', ok: !!s.graph, text: s.graph ? `${s.graph.nodes.toLocaleString('es-ES')} cruces · ${day(s.graph.at)}` : 'unos 15 MB', need: 'calcular rutas a pie y recalcular si te desvías' },
    { stage: 'places', ok: !!s.places, text: s.places ? `${s.places.count.toLocaleString('es-ES')} sitios · ${day(s.places.at)}` : 'unos 3 MB', need: 'buscar sitios y saber qué hay en un punto' },
    { stage: 'pois', ok: !!s.pois, text: s.pois ? `${s.pois.count.toLocaleString('es-ES')} puntos · ${day(s.pois.at)}` : 'poco', need: 'fuentes, baños, farmacias, cafés y heladerías cerca' },
    { stage: 'metro', ok: !!s.metro, text: s.metro ? `${s.metro.stations} estaciones · ${day(s.metro.at)}` : 'poco', need: 'ver el metro en el mapa y la estación más cercana' },
    { stage: 'photos', ok: s.photos.have >= s.photos.total, text: s.photos.have >= s.photos.total ? `${s.photos.total} sitios` : `faltan ${s.photos.total - s.photos.have} de ${s.photos.total}`, need: 'ver la foto y el resumen de cada monumento' },
    { stage: 'weather', ok: s.weather !== null, text: s.weather !== null ? `guardado ${day(s.weather)}` : 'poco', need: 'ver el tiempo' },
    { stage: 'files', ok: s.blobs.missing === 0, text: s.blobs.total === 0 ? 'no hay archivos todavía' : s.blobs.missing === 0 ? `${s.blobs.total} archivos` : `faltan ${s.blobs.missing} de ${s.blobs.total}`, need: 'abrir entradas, fotos y tiques' },
  ];
}

const mmss = (ms: number) => { const t = Math.max(0, Math.round(ms / 1000)); return t < 60 ? `${t} s` : `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s`; };

/** Cómo va una etapa mientras se descarga: «120 de 441», «bajando…» o nada si no entra en esta descarga. */
export function liveText(a: AutoState, st: Stage): string | null {
  if (a.phase !== 'running' || !a.need?.includes(st)) return null;
  const p = a.progress?.[st];
  if (p?.end) return p.end === 'ok' ? 'recién descargado' : 'no se pudo, se reintentará';
  if (!p || p.total <= 1) return 'descargando…';
  return `descargando ${p.done} de ${p.total}`;
}

/** Un segundo que pasa (para el «lleva 1 min 20 s»). */
function useTick(on: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}

export function OfflineCard() {
  const [st, setSt] = useState<OfflineStatus | undefined>();
  const auto = useAutoOffline();
  const cur = auto.phase === 'running';
  const now = useTick(cur);
  const failed = auto.phase === 'error' ? auto.failed : [];
  const online = useOnline();
  const me = useSettings().profile ?? 'jesus';
  const other = travellers[me === 'jesus' ? 'lucia' : 'jesus'].name;
  const refresh = () => offlineStatus().then(setSt).catch(() => undefined);
  useEffect(() => { void refresh(); }, [auto.phase]);
  const all = st ? rows(st).every((r) => r.ok) : false;
  const go = () => void runAuto(all ? 'all' : 'missing');
  return (
    <section class="card stack" style={{ gap: '0.5rem' }} aria-label="Preparar para ir sin conexión">
      <h2>Sin conexión</h2>
      <p class="small">{all ? 'Todo listo: sin datos podéis ver el mapa, calcular rutas, buscar sitios y abrir las entradas.' : auto.phase === 'waiting-wifi' ? 'Se descargará sola en cuanto haya wifi (o pulsa el botón).' : 'Se descarga sola, en segundo plano, cuando hay conexión. No tienes que hacer nada.'}</p>
      {st && (
        <ul class="list" style={{ gap: '0.25rem' }}>
          {rows(st).map((r) => {
            const live = liveText(auto, r.stage);
            const busy = !!live && !auto.progress?.[r.stage]?.end;
            const ok = auto.progress?.[r.stage]?.end === 'ok' || (r.ok && !busy);
            return (
              <li key={r.stage} class="row" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                <span class={`chip ${ok ? 'ok' : 'pending'}`} aria-label={ok ? 'Descargado' : busy ? 'Descargando' : 'Falta'}>{ok ? '✓' : busy ? '↓' : '·'}</span>
                <span class="small"><b>{STAGE_LABEL[r.stage]}</b> <span class="muted">— {live ?? r.text}. Sirve para {r.need}.</span></span>
              </li>
            );
          })}
        </ul>
      )}
      {cur && (
        <div role="status">
          <p class="small">Descargando: {overallPct(auto)} % · ahora {activeStages(auto).map((x) => STAGE_LABEL[x].toLowerCase()).join(', ') || 'terminando'}{auto.startedAt ? ` · lleva ${mmss(now - auto.startedAt)}` : ''}</p>
          <progress value={overallPct(auto)} max={100} aria-label="Descargando" style={{ width: '100%' }} />
          <p class="small muted">Deja la app abierta hasta que termine.</p>
        </div>
      )}
      {failed.length > 0 && <p class="small pending">No se ha podido descargar: {failed.map((f) => STAGE_LABEL[f]).join(', ')}. Se reintentará sola; también puedes pulsar el botón.</p>}
      <button type="button" class="btn primary" disabled={cur || !online} onClick={go}>
        <Icon name="map" /> {cur ? 'Descargando…' : all ? 'Actualizar todo' : 'Descargar ahora'}
      </button>
      {!online && <p class="small muted">Sin conexión ahora mismo.</p>}
      <p class="small muted">Sincronizar con {other} y abrir cartas o la cápsula del tiempo sí necesitan conexión: el servidor guarda cada sorpresa hasta su hora.</p>
    </section>
  );
}
