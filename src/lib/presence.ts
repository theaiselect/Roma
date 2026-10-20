import { useEffect } from 'preact/hooks';
import { setShared, useSharedState } from '@/lib/plan-state';
import { getSettings } from '@/lib/settings';
import type { Who } from '@/data/types';

// «Estoy aquí»: cada móvil anota cuándo fue la última vez que abrió la app. El otro lo lee y así
// «¿Está todo listo?» sabe que los dos móviles se hablan. Una sola fila por persona.
const EVERY = 15 * 60_000;
let last = 0;

function ping(): void {
  const s = getSettings();
  if (!s.profile || !s.tripCode || Date.now() - last < EVERY) return;
  last = Date.now();
  void setShared(`seen:${s.profile}`, last);
}

export function usePresencePing(): void {
  useEffect(() => {
    ping();
    const vis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', vis);
    const id = window.setInterval(vis, EVERY);
    return () => { document.removeEventListener('visibilitychange', vis); window.clearInterval(id); };
  }, []);
}

/** Última vez (ms) que ese viajero abrió la app, o null si nunca. */
export function usePartnerSeen(who: Who): number | null {
  const v = useSharedState().get(`seen:${who}`)?.value;
  return typeof v === 'number' ? v : null;
}
