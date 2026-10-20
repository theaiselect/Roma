import { db, deleteBlobLocal, getMeta, setMeta, DB_EVENT, type Entity } from '@/lib/db';
import { blobIdsOf, liveBlobIds, orphanBlobIds } from '@/lib/blob-refs';
import { refreshPrivate } from '@/lib/private';
import { mergeIncoming } from '@/lib/merge';
import { getSettings } from '@/lib/settings';
import { reportSync } from '@/lib/sync-status';
import { romeToUtc } from '@/lib/time';

// Sincronización local-first: cola → push → pull. Nada se bloquea sin conexión.

let running: Promise<void> | null = null;
let debounce: number | null = null;
let disabledReason: string | null = null;

function headers(): Record<string, string> | null {
  const { tripCode, profile } = getSettings();
  return tripCode ? { 'content-type': 'application/json', 'x-trip-code': tripCode, 'x-who': profile ?? '' } : null;
}

// ── Archivos ────────────────────────────────────────────────────
const MAX_UPLOAD = 4 * 1024 * 1024;

/** Tipo con el que se sube: el servidor no acepta un tipo vacío. */
export const uploadType = (mime: string): string => mime || 'application/octet-stream';

/**
 * Sube los archivos que faltan. Un archivo que el servidor rechaza (demasiado grande, formato raro) se aparta
 * y se marca: nunca bloquea la sincronización del resto (gastos, diario, casillas…).
 * Solo para cortes de red, servidor caído o código incorrecto se para (y se reintenta luego).
 */
async function uploadBlobs(h: Record<string, string>): Promise<void> {
  const d = await db();
  const live = liveBlobIds(await d.getAll('entities'));
  const pending = (await d.getAll('blobs')).filter((b) => !b.uploaded && !b.uploadError && live.has(b.id));
  let marked = false;
  for (const b of pending) {
    if (b.blob.size > MAX_UPLOAD) { await d.put('blobs', { ...b, uploadError: 'too_large' }); marked = true; continue; }
    const res = await fetch(`/api/blob?id=${b.id}`, { method: 'POST', headers: { ...h, 'content-type': uploadType(b.mime) }, body: b.blob });
    if (res.ok) { await d.put('blobs', { ...b, uploaded: true }); continue; }
    if (res.status === 400 || res.status === 413 || res.status === 415) {
      await d.put('blobs', { ...b, uploadError: res.status === 413 ? 'too_large' : 'bad_type' });
      marked = true;
      continue;
    }
    throw new Error(`blob ${res.status}`);
  }
  if (marked) window.dispatchEvent(new CustomEvent(DB_EVENT));
}

/** Archivos de datos borrados (foto, entrada, nota de voz): fuera del móvil y del servidor. */
async function cleanupBlobs(h: Record<string, string>): Promise<void> {
  const d = await db();
  const orphans = orphanBlobIds(await d.getAll('entities'));
  for (const id of orphans) {
    const row = await d.get('blobs', id);
    if (!row) continue;
    await deleteBlobLocal(id);
    void fetch(`/api/blob?id=${id}`, { method: 'DELETE', headers: h }).catch(() => undefined);
  }
}

/** Descarga un archivo del servidor si no está en este móvil. Devuelve true si ya está. */
export async function ensureBlob(id: string): Promise<boolean> {
  const d = await db();
  if (await d.get('blobs', id)) return true;
  const h = headers();
  if (!h || !navigator.onLine) return false;
  const res = await fetch(`/api/blob?id=${id}`, { headers: h });
  if (!res.ok) return false;
  const blob = await res.blob();
  await d.put('blobs', { id, blob, mime: blob.type, uploaded: true, createdAt: Date.now() });
  window.dispatchEvent(new CustomEvent(DB_EVENT));
  return true;
}

/** Las entradas (QR/PDF) se descargan siempre para tenerlas sin conexión. */
async function prefetchTickets(): Promise<void> {
  const d = await db();
  const tickets = (await d.getAllFromIndex('entities', 'kind', 'ticket')).filter((t) => !t.deleted);
  for (const t of tickets) for (const id of blobIdsOf(t)) await ensureBlob(id).catch(() => false);
}

// ── Cartas, cápsula, votos y respuestas que llegaron cerrados ───
function canUnlock(e: Entity, mine: Entity[], now: number): boolean {
  if (e.kind === 'letter' || e.kind === 'capsule') return typeof e.unlockAt === 'string' && now >= romeInstantClient(e.unlockAt);
  const key = e.kind === 'vote' ? 'topic' : 'questionId';
  if (mine.some((m) => m.kind === e.kind && m[key] === e[key])) return true;
  const date = /(\d{4}-\d{2}-\d{2})$/.exec(String(e[key] ?? ''))?.[1];
  return date ? now >= romeInstantClient(date) + 86_400_000 - 3600_000 : false;
}

function romeInstantClient(s: string): number {
  const [date, time = '00:00'] = s.split('T') as [string, string?];
  return romeToUtc(date, time);
}

async function refreshLocked(h: Record<string, string>): Promise<void> {
  const d = await db();
  const all = await d.getAll('entities');
  const me = getSettings().profile;
  const mine = all.filter((e) => e.author === me && !e.deleted);
  const now = Date.now();
  const ids = all.filter((e) => e.locked && canUnlock(e, mine, now)).map((e) => e.id);
  if (!ids.length) return;
  const res = await fetch(`/api/sync?ids=${ids.map(encodeURIComponent).join(',')}`, { headers: h });
  if (!res.ok) return;
  const body = (await res.json()) as { entities: Entity[] };
  const tx = d.transaction('entities', 'readwrite');
  for (const e of body.entities) if (!e.locked) await tx.store.put(e);
  await tx.done;
  window.dispatchEvent(new CustomEvent(DB_EVENT));
}

/** Tandas pequeñas: cada envío pesa poco (límite de 4,5 MB de Vercel) y el servidor lo guarda enseguida. */
const PUSH_BATCH = 25;

async function push(h: Record<string, string>): Promise<void> {
  const d = await db();
  for (;;) {
    const queued = (await d.getAll('outbox')).slice(0, PUSH_BATCH);
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
    if (queued.length < PUSH_BATCH) return;
  }
}

async function pull(h: Record<string, string>): Promise<number> {
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
      await uploadBlobs(h);
      await push(h);
      await pull(h);
      await refreshLocked(h);
      await refreshPrivate(h).catch(() => undefined);
      await prefetchTickets();
      await cleanupBlobs(h).catch(() => undefined);
      disabledReason = null;
      reportSync({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 401: código incorrecto. 501/503: servidor aún sin configurar. No insistimos cada 30 s.
      if (/ (401|429|501|503)$/.test(msg)) disabledReason = msg;
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
