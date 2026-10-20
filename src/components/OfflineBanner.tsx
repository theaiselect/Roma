import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { STAGE_LABEL } from '@/lib/offline-data';
import { runAuto, startAutoOffline, useAutoOffline } from '@/lib/auto-offline';

/** Aviso discreto bajo la barra superior: la descarga para ir sin conexión se hace sola y aquí se ve cómo va. */
export function OfflineBanner() {
  const s = useAutoOffline();
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { startAutoOffline(); }, []);
  useEffect(() => {
    if (s.phase !== 'done' || !s.ranHere) return;
    setShowDone(true);
    const t = window.setTimeout(() => setShowDone(false), 6000);
    return () => window.clearTimeout(t);
  }, [s.phase, s.ranHere]);

  if (s.phase === 'running') {
    const pct = Math.round((s.done / Math.max(s.total, 1)) * 100);
    return (
      <div class="offlinebar" role="status" aria-live="polite">
        <Icon name="map" size={16} />
        <span>Guardando Roma para usarla sin conexión · {s.stage ? STAGE_LABEL[s.stage] : ''} {pct} %</span>
      </div>
    );
  }
  if (s.phase === 'waiting-wifi') {
    return (
      <div class="offlinebar" role="status">
        <Icon name="map" size={16} />
        <span>Roma se guardará sola cuando haya wifi.</span>
        <button type="button" class="btn ghost" onClick={() => void runAuto(true)}>Guardar ya</button>
      </div>
    );
  }
  if (showDone) return <div class="offlinebar ok" role="status"><Icon name="check" size={16} /><span>Roma ya está guardada: mapa, rutas y búsqueda funcionan sin conexión.</span></div>;
  return null;
}
