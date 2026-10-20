import { appNow } from '@/lib/clock';
import { db, DB_EVENT, type Entity } from '@/lib/db';
import { readLocal, writeLocal } from '@/lib/local';
import { wins } from '@/lib/merge';

// Copia de seguridad (F36): todo a un JSON (datos vivos + archivos) y restaurar en cualquier navegador.
export interface Backup {
  app: 'roma';
  version: 1;
  exportedAt: number;
  entities: Entity[];
  blobs: { id: string; mime: string; data: string }[];
}

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
  const blobs = await Promise.all((await d.getAll('blobs')).map(async (b) => ({ id: b.id, mime: b.mime, data: await toBase64(b.blob) })));
  return { app: 'roma', version: 1, exportedAt: Date.now(), entities, blobs };
}

const LAST_KEY = 'roma-last-backup';
export const lastBackupAt = (): number | null => readLocal<number | null>(LAST_KEY, null);

export async function downloadBackup(): Promise<void> {
  const b = await makeBackup();
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([blob], `roma-copia-${date}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    let shared = true;
    await navigator.share({ files: [file], title: 'Copia de seguridad de Roma' }).catch(() => { shared = false; });
    if (shared) writeLocal(LAST_KEY, appNow());
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  writeLocal(LAST_KEY, appNow());
}

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
  window.dispatchEvent(new CustomEvent(DB_EVENT));
  return { entities: n, blobs: m };
}
