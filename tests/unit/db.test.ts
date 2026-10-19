import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Entorno Node (su Blob se clona como en un navegador real) con lo mínimo de window y localStorage.
const target = new EventTarget();
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) }),
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // Un «navegador» nuevo por prueba: IndexedDB vacío.
  globalThis.indexedDB = new IDBFactory();
});

describe('datos locales y cola de envío', () => {
  it('guardar nunca depende de la red: entra en IndexedDB y en la cola', async () => {
    const { save, listKind, outboxSize } = await import('@/lib/db');
    await save({ kind: 'expense', amountCents: 1250 });
    expect((await listKind('expense'))[0]?.amountCents).toBe(1250);
    expect(await outboxSize()).toBe(1);
  });

  it('la cola sobrevive a cerrar y abrir la app', async () => {
    const a = await import('@/lib/db');
    await a.save({ kind: 'expense', amountCents: 500 });
    (await a.db()).close();
    vi.resetModules(); // «reabrir la app»: módulos nuevos, misma base de datos
    const b = await import('@/lib/db');
    expect(await b.outboxSize()).toBe(1);
  });

  it('borrar deja una lápida, no borra físicamente', async () => {
    const { save, remove, listKind } = await import('@/lib/db');
    const e = await save({ kind: 'gift', what: 'imán' });
    await remove(e.id);
    expect(await listKind('gift')).toHaveLength(0);
    expect((await listKind('gift', true))[0]?.deleted).toBe(true);
  });

  it('cada guardado sube updatedAt aunque el reloj no avance', async () => {
    const { save } = await import('@/lib/db');
    const one = await save({ id: 'check:x', kind: 'check', done: true });
    const two = await save({ id: 'check:x', kind: 'check', done: false });
    expect(two.updatedAt).toBeGreaterThan(one.updatedAt);
  });
});

describe('copia de seguridad (F36)', () => {
  it('exportar e importar en otro navegador deja los datos iguales', async () => {
    const db1 = await import('@/lib/db');
    const bk = await import('@/lib/backup');
    await db1.save({ kind: 'expense', amountCents: 999, note: 'gelato' });
    const blobId = await db1.putBlob(new Blob(['%PDF-1.4 entrada'], { type: 'application/pdf' }));
    await db1.save({ kind: 'ticket', reservationId: 'pantheon', blobId, mime: 'application/pdf', name: 'panteon.pdf' });
    const json = JSON.stringify(await bk.makeBackup());
    const before = (await (await db1.db()).getAll('entities')).sort((x, y) => x.id.localeCompare(y.id));

    // «Otro navegador»: base de datos vacía
    (await db1.db()).close();
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    const db2 = await import('@/lib/db');
    const bk2 = await import('@/lib/backup');
    const r = await bk2.restoreBackup(json);
    expect(r).toEqual({ entities: 2, blobs: 1 });
    const after = (await (await db2.db()).getAll('entities')).sort((x, y) => x.id.localeCompare(y.id));
    expect(after).toEqual(before);
    expect(await (await db2.getBlob(blobId))?.text()).toBe('%PDF-1.4 entrada');
  });
});
