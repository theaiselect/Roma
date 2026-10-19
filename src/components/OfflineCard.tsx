import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { offlineStatus, prepareOffline, STAGE_LABEL, type OfflineStatus, type Stage } from '@/lib/offline-data';
import { estimateMB } from '@/lib/offline-map';

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
    { stage: 'weather', ok: s.weather !== null, text: s.weather !== null ? `guardado ${day(s.weather)}` : 'poco', need: 'ver el tiempo' },
    { stage: 'files', ok: s.blobs.missing === 0, text: s.blobs.total === 0 ? 'no hay archivos todavía' : s.blobs.missing === 0 ? `${s.blobs.total} archivos` : `faltan ${s.blobs.missing} de ${s.blobs.total}`, need: 'abrir entradas, fotos y tiques' },
  ];
}

export function OfflineCard() {
  const [st, setSt] = useState<OfflineStatus | undefined>();
  const [cur, setCur] = useState<{ stage: Stage; done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<Stage[]>([]);
  const online = useOnline();
  const refresh = () => offlineStatus().then(setSt).catch(() => undefined);
  useEffect(() => { void refresh(); }, []);
  const go = async () => {
    setFailed([]);
    setCur({ stage: 'map', done: 0, total: 1 });
    const bad = await prepareOffline((stage, done, total) => setCur({ stage, done, total }));
    setFailed(bad); setCur(null); await refresh();
  };
  const all = st ? rows(st).every((r) => r.ok) : false;
  return (
    <section class="card stack" style={{ gap: '0.5rem' }} aria-label="Preparar para ir sin conexión">
      <h2>Sin conexión</h2>
      <p class="small">{all ? 'Todo listo: sin datos podéis ver el mapa, calcular rutas, buscar sitios y abrir las entradas.' : 'Con wifi, antes de salir, descarga todo lo que necesitas en Roma. Se hace una vez.'}</p>
      {st && (
        <ul class="list" style={{ gap: '0.25rem' }}>
          {rows(st).map((r) => (
            <li key={r.stage} class="row" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
              <span class={`chip ${r.ok ? 'ok' : 'pending'}`} aria-label={r.ok ? 'Descargado' : 'Falta'}>{r.ok ? '✓' : '·'}</span>
              <span class="small"><b>{STAGE_LABEL[r.stage]}</b> <span class="muted">— {r.text}. Sirve para {r.need}.</span></span>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <div role="status">
          <p class="small">{STAGE_LABEL[cur.stage]}… {Math.round((cur.done / Math.max(cur.total, 1)) * 100)} %</p>
          <progress value={cur.done} max={cur.total} aria-label="Descargando" style={{ width: '100%' }} />
        </div>
      )}
      {failed.length > 0 && <p class="small pending">No se ha podido descargar: {failed.map((f) => STAGE_LABEL[f]).join(', ')}. Vuelve a pulsar con mejor conexión.</p>}
      <button type="button" class="btn primary" disabled={!!cur || !online} onClick={() => void go()}>
        <Icon name="map" /> {cur ? 'Descargando…' : all ? 'Actualizar todo' : 'Preparar para ir sin conexión'}
      </button>
      {!online && <p class="small muted">Sin conexión ahora mismo.</p>}
      <p class="small muted">Sincronizar con Lucía y abrir cartas o la cápsula del tiempo sí necesitan conexión: el servidor guarda cada sorpresa hasta su hora.</p>
    </section>
  );
}
