import { useEffect, useState } from 'preact/hooks';
import { METRO_MAX_AGE } from '@/lib/metro-map';
import { GRAPH_VERSION, offlineStatus, prepareOffline, type OfflineStatus, type Stage } from '@/lib/offline-data';

// Lo necesario para ir sin conexión se descarga SOLO, en segundo plano, cuando hay conexión y la primera vez.
// Con datos móviles espera a la wifi (a menos que se pida a mano); nunca interrumpe lo que estás haciendo.
const DAY = 24 * 3600_000;
export const MAP_MAX_AGE = 30 * DAY;
export const DATA_MAX_AGE = 14 * DAY;
export const PHOTOS_MAX_AGE = 45 * DAY;

/** Qué etapas faltan o están viejas. El tiempo se refresca por su cuenta. */
export function stagesNeeded(s: OfflineStatus, now: number): Stage[] {
  const out: Stage[] = [];
  if (!s.map || now - s.map.at > MAP_MAX_AGE || !s.map.current || (s.map.total !== undefined && s.map.tiles < s.map.total * 0.98)) out.push('map');
  if (!s.graph || now - s.graph.at > DATA_MAX_AGE || (s.graph.v ?? 1) < GRAPH_VERSION) out.push('graph');
  if (!s.places || now - s.places.at > DATA_MAX_AGE || (s.geo !== undefined && s.geo.have < s.geo.total)) out.push('places');
  if (!s.pois || now - s.pois.at > DATA_MAX_AGE) out.push('pois');
  if (!s.metro || now - s.metro.at > METRO_MAX_AGE) out.push('metro');
  if (s.photos.have < s.photos.total || (s.photos.at !== undefined && now - s.photos.at > PHOTOS_MAX_AGE)) out.push('photos');
  if (s.blobs.missing > 0) out.push('files');
  return out;
}

export type AutoPhase = 'idle' | 'running' | 'waiting-wifi' | 'offline' | 'done' | 'error';
export interface StageProgress { done: number; total: number; end?: 'ok' | 'fail' }
export interface AutoState {
  phase: AutoPhase;
  /** La última etapa que avisó de progreso (las etapas van a la vez). */
  stage?: Stage;
  done: number; total: number; failed: Stage[]; ranHere: boolean;
  /** Etapas de esta descarga y cómo va cada una. */
  need?: Stage[];
  progress?: Partial<Record<Stage, StageProgress>>;
  startedAt?: number;
}

let state: AutoState = { phase: 'idle', done: 0, total: 1, failed: [], ranHere: false };
let running = false;
let retries = 0;
const listeners = new Set<() => void>();
const set = (patch: Partial<AutoState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

/** Porcentaje total (cada etapa pesa igual; una terminada cuenta entera). */
export function overallPct(s: Pick<AutoState, 'need' | 'progress'>): number {
  const need = s.need ?? [];
  if (!need.length) return 0;
  const sum = need.reduce((a, st) => {
    const p = s.progress?.[st];
    return a + (p?.end ? 1 : p ? Math.min(p.done / Math.max(p.total, 1), 0.99) : 0);
  }, 0);
  return Math.round((sum / need.length) * 100);
}

/** Etapas que se están bajando ahora mismo. */
export const activeStages = (s: Pick<AutoState, 'need' | 'progress'>): Stage[] => (s.need ?? []).filter((st) => !s.progress?.[st]?.end);

interface Conn extends EventTarget { saveData?: boolean; type?: string }
const connection = (): Conn | undefined => (navigator as unknown as { connection?: Conn }).connection;

export const ALL_STAGES: Stage[] = ['map', 'graph', 'places', 'pois', 'metro', 'photos', 'weather', 'files'];

/**
 * Descarga lo que falte. Sin `mode` respeta la espera de wifi. `missing`: ya, aunque sean datos móviles, solo lo que
 * falta. `all`: ya, y vuelve a bajarlo todo.
 */
export async function runAuto(mode?: 'missing' | 'all'): Promise<void> {
  if (running) return;
  if (!navigator.onLine) { set({ phase: 'offline' }); return; }
  const c = connection();
  if (!mode && (c?.saveData || c?.type === 'cellular')) { set({ phase: 'waiting-wifi' }); return; }
  let need: Stage[];
  try {
    need = mode === 'all' ? ALL_STAGES : stagesNeeded(await offlineStatus(), Date.now());
  } catch { return; }
  if (!need.length) { set({ phase: state.ranHere ? 'done' : 'idle', failed: [] }); return; }
  running = true;
  let progress: Partial<Record<Stage, StageProgress>> = {};
  set({ phase: 'running', done: 0, total: 1, failed: [], stage: need[0], need, progress, startedAt: Date.now() });
  void navigator.storage?.persist?.().catch(() => undefined);
  try {
    const failed = await prepareOffline(
      (stage, done, total) => { progress = { ...progress, [stage]: { done, total } }; set({ stage, done, total, progress }); },
      undefined, need,
      (stage, ok) => { progress = { ...progress, [stage]: { ...(progress[stage] ?? { done: 1, total: 1 }), end: ok ? 'ok' : 'fail' } }; set({ progress }); },
    );
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
