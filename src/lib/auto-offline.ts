import { useEffect, useState } from 'preact/hooks';
import { offlineStatus, prepareOffline, type OfflineStatus, type Stage } from '@/lib/offline-data';

// Lo necesario para ir sin conexión se descarga SOLO, en segundo plano, cuando hay conexión y la primera vez.
// Con datos móviles espera a la wifi (a menos que se pida a mano); nunca interrumpe lo que estás haciendo.
const DAY = 24 * 3600_000;
export const MAP_MAX_AGE = 30 * DAY;
export const DATA_MAX_AGE = 14 * DAY;

/** Qué etapas faltan o están viejas. El tiempo se refresca por su cuenta. */
export function stagesNeeded(s: OfflineStatus, now: number): Stage[] {
  const out: Stage[] = [];
  if (!s.map || now - s.map.at > MAP_MAX_AGE) out.push('map');
  if (!s.graph || now - s.graph.at > DATA_MAX_AGE) out.push('graph');
  if (!s.places || now - s.places.at > DATA_MAX_AGE) out.push('places');
  if (!s.pois || now - s.pois.at > DATA_MAX_AGE) out.push('pois');
  if (s.blobs.missing > 0) out.push('files');
  return out;
}

export type AutoPhase = 'idle' | 'running' | 'waiting-wifi' | 'offline' | 'done' | 'error';
export interface AutoState { phase: AutoPhase; stage?: Stage; done: number; total: number; failed: Stage[]; ranHere: boolean }

let state: AutoState = { phase: 'idle', done: 0, total: 1, failed: [], ranHere: false };
let running = false;
let retries = 0;
const listeners = new Set<() => void>();
const set = (patch: Partial<AutoState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

interface Conn extends EventTarget { saveData?: boolean; type?: string }
const connection = (): Conn | undefined => (navigator as unknown as { connection?: Conn }).connection;

/** Descarga lo que falte. `force` ignora la espera de wifi y vuelve a bajarlo todo. */
export async function runAuto(force = false): Promise<void> {
  if (running) return;
  if (!navigator.onLine) { set({ phase: 'offline' }); return; }
  const c = connection();
  if (!force && (c?.saveData || c?.type === 'cellular')) { set({ phase: 'waiting-wifi' }); return; }
  let need: Stage[];
  try {
    need = force ? ['map', 'graph', 'places', 'pois', 'weather', 'files'] : stagesNeeded(await offlineStatus(), Date.now());
  } catch { return; }
  if (!need.length) { set({ phase: state.ranHere ? 'done' : 'idle', failed: [] }); return; }
  running = true;
  set({ phase: 'running', done: 0, total: 1, failed: [], stage: need[0] });
  void navigator.storage?.persist?.().catch(() => undefined);
  try {
    const failed = await prepareOffline((stage, done, total) => set({ stage, done, total }), undefined, need);
    set({ phase: failed.length ? 'error' : 'done', failed, ranHere: true });
    if (failed.length && retries++ < 3) window.setTimeout(() => void runAuto(), 5 * 60_000);
    if (!failed.length) retries = 0;
  } catch {
    set({ phase: 'error' });
  } finally { running = false; }
}

let started = false;
/** Se llama una vez al abrir la app. En pruebas automáticas no arranca sola (salvo `?autooffline`). */
export function startAutoOffline(): void {
  if (started) return;
  started = true;
  if (navigator.webdriver && !location.search.includes('autooffline')) return;
  const kick = () => void runAuto();
  window.setTimeout(kick, 3500);
  window.addEventListener('online', kick);
  connection()?.addEventListener('change', kick);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  window.setInterval(kick, 10 * 60_000);
}

export function useAutoOffline(): AutoState {
  const [s, setS] = useState(state);
  useEffect(() => {
    const on = () => setS(state);
    listeners.add(on);
    on();
    return () => { listeners.delete(on); };
  }, []);
  return s;
}
