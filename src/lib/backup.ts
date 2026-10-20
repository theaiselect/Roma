import { appNow } from '@/lib/clock';
import { db, DB_EVENT, type Entity } from '@/lib/db';
import { readLocal, writeLocal } from '@/lib/local';
import { wins } from '@/lib/merge';
import { liveBlobIds } from '@/lib/blob-refs';

// Copia de seguridad (F36): todo a un JSON (datos vivos + archivos) y restaurar en cualquier navegador.
export interface Backup {
  app: 'roma';
  version: 1;
  exportedAt: number;
  entities: Entity[];
  blobs: { id: string; mime: string; data: string }[];
  /** Lo que solo vive en este móvil (Mi ficha de emergencia, frases favoritas). */
  local?: Record<string, string>;
}

/** Datos solo locales que también van en la copia. */
const LOCAL_KEYS = ['roma-my-card', 'roma-fav-phrases'];

async function toBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(data: string, mime: string): Blob {
  const bin = atob(data);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export async function makeBackup(): Promise<Backup> {
  const d = await db();
  const entities = await d.getAll('entities');
  // Solo los archivos que cita algún dato vivo: lo borrado no viaja en la copia.
  const live = liveBlobIds(entities);
  const blobs = await Promise.all((await d.getAll('blobs')).filter((b) => live.has(b.id)).map(async (b) => ({ id: b.id, mime: b.mime, data: await toBase64(b.blob) })));
  const local: Record<string, string> = {};
  for (const k of LOCAL_KEYS) { try { const v = localStorage.getItem(k); if (v !== null) local[k] = v; } catch { /* sin almacenamiento */ } }
  return { app: 'roma', version: 1, exportedAt: Date.now(), entities, blobs, local };
}

const LAST_KEY = 'roma-last-backup';
export const lastBackupAt = (): number | null => readLocal<number | null>(LAST_KEY, null);

/** Prepara el archivo de la copia (puede tardar con muchas fotos). */
export async function prepareBackup(): Promise<File> {
  const b = await makeBackup();
  const date = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(b)], `roma-copia-${date}.json`, { type: 'application/json' });
}

/** Ya hay copia guardada (se llama al compartirla o descargarla). */
export const markBackupDone = (): void => writeLocal(LAST_KEY, appNow());

/** Restaura una copia: cada dato se fusiona con la regla de último cambio; los archivos se añaden. */
export async function restoreBackup(text: string): Promise<{ entities: number; blobs: number }> {
  const b = JSON.parse(text) as Backup;
  if (b.app !== 'roma' || !Array.isArray(b.entities)) throw new Error('No es una copia de Roma');
  const d = await db();
  let n = 0;
  const tx = d.transaction(['entities', 'outbox', 'blobs'], 'readwrite');
  for (const e of b.entities) {
    const cur = await tx.objectStore('entities').get(e.id);
    if (wins(e, cur)) {
      await tx.objectStore('entities').put(e);
      if (!e.locked) await tx.objectStore('outbox').put({ entityId: e.id, kind: e.kind, queuedAt: Date.now() });
      n++;
    }
  }
  let m = 0;
  for (const x of b.blobs ?? []) {
    if (await tx.objectStore('blobs').get(x.id)) continue;
    await tx.objectStore('blobs').put({ id: x.id, blob: fromBase64(x.data, x.mime), mime: x.mime, uploaded: false, createdAt: Date.now() });
    m++;
  }
  await tx.done;
  // Mi ficha y las favoritas: solo si este móvil no tiene las suyas.
  for (const [k, v] of Object.entries(b.local ?? {})) { try { if (LOCAL_KEYS.includes(k) && localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch { /* ignore */ } }
  window.dispatchEvent(new CustomEvent(DB_EVENT));
  return { entities: n, blobs: m };
}
