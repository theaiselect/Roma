// Qué archivos (fotos, notas de voz, entradas) cita cada dato. Sin dependencias: lo usan la sincronización,
// la descarga sin conexión, la copia de seguridad y la limpieza de lo borrado.

const FIELDS = ['blobId', 'photoBlobId', 'voiceBlobId'];
const LIST_FIELDS = ['voiceBlobIds', 'photoBlobIds', 'pageBlobIds'];

interface Ref { kind?: unknown; deleted?: unknown; [k: string]: unknown }

/** Todos los archivos que cita un dato (campos sueltos y listas, p. ej. varias notas de voz o las páginas de un PDF). */
export function blobIdsOf(e: object): string[] {
  const r = e as Record<string, unknown>;
  const out: string[] = [];
  for (const f of FIELDS) { const v = r[f]; if (typeof v === 'string') out.push(v); }
  for (const f of LIST_FIELDS) { const v = r[f]; if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x); }
  return out;
}

/**
 * Los imprescindibles para usar el dato sin conexión. Una entrada en PDF con sus páginas ya pasadas a imagen
 * se ve con las imágenes: el PDF original es opcional (si pesa demasiado, solo vive en el móvil que lo añadió).
 */
export function requiredBlobIds(e: object): string[] {
  const r = e as Ref;
  const pages = Array.isArray(r.pageBlobIds) ? (r.pageBlobIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (r.kind === 'ticket' && pages.length) return pages;
  return blobIdsOf(e);
}

/** Archivos que cita algún dato vivo (no borrado). */
export function liveBlobIds(entities: readonly Ref[], required = false): Set<string> {
  const out = new Set<string>();
  for (const e of entities) if (!e.deleted) for (const id of required ? requiredBlobIds(e) : blobIdsOf(e)) out.add(id);
  return out;
}

/** Archivos que solo citaban datos ya borrados: se pueden quitar del móvil y del servidor. */
export function orphanBlobIds(entities: readonly Ref[]): Set<string> {
  const live = liveBlobIds(entities);
  const out = new Set<string>();
  for (const e of entities) if (e.deleted) for (const id of blobIdsOf(e)) if (!live.has(id)) out.add(id);
  return out;
}
