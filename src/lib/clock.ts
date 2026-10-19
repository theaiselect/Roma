import { useEffect, useState } from 'preact/hooks';
import { now as parseNow } from '@/lib/time';

const KEY = 'roma-now-offset';
let offset = 0;

/**
 * Lee ?now=2026-10-31T13:00 al arrancar y guarda el desfase en sessionStorage,
 * así la simulación sobrevive a la navegación y el reloj sigue avanzando.
 */
export function initClock(search = location.search): void {
  const real = Date.now();
  const sim = parseNow(search, real);
  try {
    if (sim !== real) {
      offset = sim - real;
      sessionStorage.setItem(KEY, String(offset));
    } else {
      offset = Number(sessionStorage.getItem(KEY) ?? 0) || 0;
    }
  } catch {
    offset = sim - real;
  }
}

export function appNow(): number {
  return Date.now() + offset;
}

export function isSimulated(): boolean {
  return offset !== 0;
}

export function stopSimulation(): void {
  offset = 0;
  try { sessionStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

/** Hora actual que se refresca cada `everyMs`. */
export function useNow(everyMs = 30_000): number {
  const [t, setT] = useState(appNow);
  useEffect(() => {
    const tick = () => setT(appNow());
    const id = window.setInterval(tick, everyMs);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [everyMs]);
  return t;
}
