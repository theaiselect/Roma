import { useEffect, useState } from 'preact/hooks';
import { DB_EVENT, outboxSize } from '@/lib/db';

export type SyncState = 'ok' | 'pending' | 'offline';

const EVENT = 'roma-sync-change';
let lastError: string | null = null;
let lastSyncAt: number | null = null;

export function reportSync(result: { ok: boolean; error?: string }): void {
  if (result.ok) { lastSyncAt = Date.now(); lastError = null; } else lastError = result.error ?? 'error';
  window.dispatchEvent(new Event(EVENT));
}

export function syncInfo(): { lastSyncAt: number | null; lastError: string | null } {
  return { lastSyncAt, lastError };
}

/** Punto de la cabecera: verde (al día), ocre con número (pendientes), gris (sin conexión). */
export function useSyncStatus(): { state: SyncState; pending: number } {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const refresh = () => { void outboxSize().then(setPending).catch(() => setPending(0)); setOnline(navigator.onLine); };
    refresh();
    const evs = ['online', 'offline', DB_EVENT, EVENT];
    evs.forEach((e) => window.addEventListener(e, refresh));
    return () => evs.forEach((e) => window.removeEventListener(e, refresh));
  }, []);
  const state: SyncState = !online ? 'offline' : pending > 0 ? 'pending' : 'ok';
  return { state, pending };
}
