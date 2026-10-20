import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { useEffect, useState } from 'preact/hooks';
import type { Who } from '@/data/types';
import { getSettings } from '@/lib/settings';

// ── Modelo de datos vivos ────────────────────────────────────────
export type EntityKind =
  | 'expense' | 'check' | 'diary' | 'photo' | 'letter' | 'capsule'
  | 'vote' | 'answer' | 'song' | 'state' | 'ticket' | 'gift' | 'saved';

export interface Entity {
  id: string;
  kind: EntityKind;
  updatedAt: number;
  deviceId: string;
  author: Who;
  /** Lo sella el servidor al aceptar el cambio. */
  serverAt?: number;
  deleted?: boolean;
  [field: string]: unknown;
}

interface RomaDB extends DBSchema {
  entities: { key: string; value: Entity; indexes: { kind: EntityKind } };
  outbox: { key: string; value: { entityId: string; kind: EntityKind; queuedAt: number } };
  blobs: { key: string; value: BlobRow };
  meta: { key: string; value: { key: string; value: unknown } };
}

/** Archivo guardado en el móvil. `uploadError`: el servidor no lo acepta (demasiado grande o formato raro). */
export interface BlobRow { id: string; blob: Blob; mime: string; uploaded: boolean; createdAt: number; uploadError?: 'too_large' | 'bad_type' }

const EVENT = 'roma-db-change';
let dbp: Promise<IDBPDatabase<RomaDB>> | null = null;

export function db(): Promise<IDBPDatabase<RomaDB>> {
  dbp ??= openDB<RomaDB>('roma', 1, {
    upgrade(d) {
      const e = d.createObjectStore('entities', { keyPath: 'id' });
      e.createIndex('kind', 'kind');
      d.createObjectStore('outbox', { keyPath: 'entityId' });
      d.createObjectStore('blobs', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  return dbp;
}

export function uuid(): string {
  return crypto.randomUUID();
}

function notify(kind?: EntityKind): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: kind }));
}

/**
 * Guarda un dato vivo: IndexedDB + cola de envío. Nunca depende de la red.
 * Devuelve la entidad tal como quedó guardada.
 */
export async function save<T extends Partial<Entity> & { kind: EntityKind }>(data: T): Promise<Entity> {
  const s = getSettings();
  const d = await db();
  const prev = data.id ? await d.get('entities', data.id) : undefined;
  const entity: Entity = {
    ...(prev ?? {}),
    ...data,
    id: data.id ?? uuid(),
    updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1),
    deviceId: s.deviceId,
    author: (data.author as Who | undefined) ?? prev?.author ?? s.profile ?? 'jesus',
  } as Entity;
  const tx = d.transaction(['entities', 'outbox'], 'readwrite');
  await tx.objectStore('entities').put(entity);
  await tx.objectStore('outbox').put({ entityId: entity.id, kind: entity.kind, queuedAt: Date.now() });
  await tx.done;
  notify(entity.kind);
  return entity;
}

/** Borrado lógico (lápida) para que no reaparezca al sincronizar. */
export async function remove(id: string): Promise<void> {
  const d = await db();
  const prev = await d.get('entities', id);
  if (prev) await save({ ...prev, deleted: true });
}

export async function getEntity(id: string): Promise<Entity | undefined> {
  return (await db()).get('entities', id);
}

export async function listKind(kind: EntityKind, includeDeleted = false): Promise<Entity[]> {
  const all = await (await db()).getAllFromIndex('entities', 'kind', kind);
  return includeDeleted ? all : all.filter((e) => !e.deleted);
}

/** Lista reactiva de un tipo de dato vivo. */
export function useKind<T = Entity>(kind: EntityKind): T[] | null {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => { void listKind(kind).then((r) => { if (alive) setItems(r as T[]); }); };
    const on = (e: Event) => { const k = (e as CustomEvent<EntityKind | undefined>).detail; if (!k || k === kind) load(); };
    load();
    window.addEventListener(EVENT, on);
    return () => { alive = false; window.removeEventListener(EVENT, on); };
  }, [kind]);
  return items;
}

export async function outboxSize(): Promise<number> {
  return (await db()).count('outbox');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', { key, value });
}

// ── Archivos (entradas, fotos, notas de voz) ─────────────────────
export async function putBlob(blob: Blob, id = uuid()): Promise<string> {
  await (await db()).put('blobs', { id, blob, mime: blob.type, uploaded: false, createdAt: Date.now() });
  return id;
}

/** Quita un archivo de este móvil (ya no lo cita ningún dato). */
export async function deleteBlobLocal(id: string): Promise<void> {
  await (await db()).delete('blobs', id);
}

/** Archivos de este móvil que el servidor no ha aceptado, con el motivo. Se actualiza al cambiar datos. */
export function useBlobErrors(ids: readonly string[]): Map<string, NonNullable<BlobRow['uploadError']>> {
  const [m, setM] = useState(new Map<string, NonNullable<BlobRow['uploadError']>>());
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const d = await db();
      const out = new Map<string, NonNullable<BlobRow['uploadError']>>();
      for (const id of ids) { const r = await d.get('blobs', id); if (r?.uploadError) out.set(id, r.uploadError); }
      if (alive) setM(out);
    };
    void load();
    window.addEventListener(EVENT, load);
    return () => { alive = false; window.removeEventListener(EVENT, load); };
  }, [key]);
  return m;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return (await (await db()).get('blobs', id))?.blob;
}

export async function exportAll(): Promise<{ entities: Entity[] }> {
  return { entities: await (await db()).getAll('entities') };
}

export async function wipeLocal(): Promise<void> {
  const d = await db();
  d.close();
  dbp = null;
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('roma');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  notify();
}

export { EVENT as DB_EVENT };
