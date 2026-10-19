import { db, getMeta, setMeta, DB_EVENT, type Entity } from '@/lib/db';
import { mergeIncoming } from '@/lib/merge';
import { getSettings } from '@/lib/settings';
import { reportSync } from '@/lib/sync-status';

// Sincronización local-first: cola → push → pull. Nada se bloquea sin conexión.

let running: Promise<void> | null = null;
let debounce: number | null = null;
let disabledReason: string | null = null;

function headers(): HeadersInit | null {
  const code = getSettings().tripCode;
  return code ? { 'content-type': 'application/json', 'x-trip-code': code } : null;
}

async function push(h: HeadersInit): Promise<void> {
  const d = await db();
  for (;;) {
    const queued = (await d.getAll('outbox')).slice(0, 100);
    if (!queued.length) return;
    const entities = (await Promise.all(queued.map((q) => d.get('entities', q.entityId)))).filter(Boolean) as Entity[];
    const res = await fetch('/api/sync', { method: 'POST', headers: h, body: JSON.stringify({ entities }) });
    if (!res.ok) throw new Error(`push ${res.status}`);
    const body = (await res.json()) as { accepted: { id: string; serverAt: number; updatedAt: number }[] };
    const tx = d.transaction(['outbox', 'entities'], 'readwrite');
    for (const a of body.accepted) {
      const q = await tx.objectStore('outbox').get(a.id);
      const e = await tx.objectStore('entities').get(a.id);
      // Si la entidad cambió mientras se enviaba, se queda en la cola.
      if (e && e.updatedAt === a.updatedAt) {
        if (q) await tx.objectStore('outbox').delete(a.id);
        await tx.objectStore('entities').put({ ...e, serverAt: a.serverAt });
      }
    }
    // Ids rechazados (el servidor tenía algo más nuevo) salen de la cola: el pull trae la versión buena.
    const acceptedIds = new Set(body.accepted.map((a) => a.id));
    for (const e of entities) if (!acceptedIds.has(e.id)) await tx.objectStore('outbox').delete(e.id);
    await tx.done;
    if (queued.length < 100) return;
  }
}

async function pull(h: HeadersInit): Promise<number> {
  const since = (await getMeta<number>('lastPullAt')) ?? 0;
  const res = await fetch(`/api/sync?since=${since}`, { headers: h });
  if (!res.ok) throw new Error(`pull ${res.status}`);
  const body = (await res.json()) as { entities: Entity[]; serverTime: number };
  if (body.entities.length) {
    const d = await db();
    const local = new Map<string, Entity>();
    for (const e of body.entities) {
      const cur = await d.get('entities', e.id);
      if (cur) local.set(e.id, cur);
    }
    const toPut = mergeIncoming(local, body.entities);
    const tx = d.transaction('entities', 'readwrite');
    for (const e of toPut) await tx.store.put(e);
    await tx.done;
    window.dispatchEvent(new CustomEvent(DB_EVENT));
  }
  await setMeta('lastPullAt', body.serverTime);
  await setMeta('lastSyncAt', Date.now());
  return body.entities.length;
}

/** Sincroniza ahora (o se une a la sincronización en curso). */
export function requestSync(force = false): Promise<void> {
  if (running) return running;
  const h = headers();
  if (!h || !navigator.onLine || (disabledReason && !force)) return Promise.resolve();
  running = (async () => {
    try {
      await push(h);
      await pull(h);
      disabledReason = null;
      reportSync({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 401: código incorrecto. 501/503: servidor aún sin configurar. No insistimos cada 30 s.
      if (/ (401|501|503)$/.test(msg)) disabledReason = msg;
      reportSync({ ok: false, error: msg });
    } finally {
      running = null;
    }
  })();
  return running;
}

export function syncDisabledReason(): string | null {
  return disabledReason;
}

/** Arranca los disparadores: abrir, volver a primer plano, recuperar red, tras guardar (2 s) y cada 30 s. */
export function startSyncLoop(): void {
  const soon = () => {
    if (debounce) window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void requestSync(), 2000);
  };
  void requestSync();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void requestSync(); });
  window.addEventListener('online', () => void requestSync(true));
  window.addEventListener(DB_EVENT, (e) => { if ((e as CustomEvent).detail) soon(); });
  window.setInterval(() => { if (document.visibilityState === 'visible') void requestSync(); }, 30_000);
}
