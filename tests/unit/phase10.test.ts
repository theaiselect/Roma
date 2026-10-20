import { describe, expect, it } from 'vitest';
import { handlePull, handlePush, MemoryStore, type ServerEntity } from '../../api/_core';
import { blobTypeOk } from '../../api/_blobRules';
import { blobIdsOf, liveBlobIds, orphanBlobIds, requiredBlobIds } from '../../src/lib/blob-refs';

const e = (over: Partial<ServerEntity> = {}): ServerEntity => ({ id: 'gasto-1', kind: 'expense', updatedAt: 1, deviceId: 'A', author: 'jesus', ...over });

describe('sello del servidor al escribir (sin cambios perdidos)', () => {
  it('un cambio que se guarda durante una petición de novedades sale en la siguiente', async () => {
    const s = new MemoryStore();
    // El envío empieza en t=1000, pero el segundo cambio se escribe 7 s después (servidor lento).
    let t = 1000;
    const clock = () => t;
    const pull = await handlePull(s, { since: 0, who: 'lucia' }, 2000); // Lucía pide novedades en t=2000
    t = 8000;
    await handlePush(s, { entities: [e({ id: 'tarde' })] }, clock);
    const next = await handlePull(s, { since: pull.serverTime, who: 'lucia' }, 9000);
    expect(next.entities.map((x) => x.id)).toContain('tarde');
  });
  it('los sellos de una misma tanda van en orden', async () => {
    const s = new MemoryStore();
    const r = await handlePush(s, { entities: [e({ id: 'aa1' }), e({ id: 'aa2' }), e({ id: 'aa3' })] }, () => 5000);
    const at = r.accepted.map((a) => a.serverAt);
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(new Set(at).size).toBe(3);
  });
});

describe('archivos que acepta el servidor', () => {
  it('acepta fotos, PDF, audio y archivos sin tipo; rechaza SVG y HTML', () => {
    for (const t of ['image/jpeg', 'image/avif', 'image/bmp', 'image/heic', 'application/pdf', 'audio/webm;codecs=opus', 'audio/mp4', 'application/octet-stream']) expect(blobTypeOk(t), t).toBe(true);
    for (const t of ['image/svg+xml', 'text/html', '', 'application/javascript']) expect(blobTypeOk(t), t).toBe(false);
  });
});

describe('qué archivos cita cada dato', () => {
  const ticket = { kind: 'ticket', blobId: 'pdf', pageBlobIds: ['p1', 'p2'] };
  it('una entrada en PDF con páginas solo necesita las páginas', () => {
    expect(blobIdsOf(ticket).sort()).toEqual(['p1', 'p2', 'pdf']);
    expect(requiredBlobIds(ticket)).toEqual(['p1', 'p2']);
    expect(requiredBlobIds({ kind: 'ticket', blobId: 'img' })).toEqual(['img']);
  });
  it('lo borrado sobra solo si ningún dato vivo lo cita', () => {
    const all = [{ kind: 'photo', blobId: 'a', deleted: true }, { kind: 'photo', blobId: 'b', deleted: true }, { kind: 'expense', photoBlobId: 'b' }];
    expect([...orphanBlobIds(all)]).toEqual(['a']);
    expect([...liveBlobIds(all)]).toEqual(['b']);
  });
});

describe('datos privados (reserva del hotel)', () => {
  it('solo se entregan con el código del viaje', async () => {
    process.env.TRIP_CODE = 'testtest';
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;
    const { GET } = await import('../../api/private');
    expect((await GET(new Request('http://x/api/private'))).status).toBe(401);
    const ok = await GET(new Request('http://x/api/private', { headers: { 'x-trip-code': 'TEST-test' } }));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { hotel: { pin: string } }).hotel.pin).toMatch(/^\d+$/);
  });
  it('la app pública ya no lleva la reserva ni el PIN', async () => {
    const fs = await import('node:fs');
    const src = ['src/data/trip.ts', 'src/data/emergency.ts'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(src).not.toMatch(/5044007987|PIN 5702|pin: '5702'/);
  });
});

describe('regalos privados', () => {
  it('el otro no ve un regalo sin compartir; sí uno compartido; quien lo apunta, siempre', async () => {
    const s = new MemoryStore();
    const g = (id: string, shared?: boolean): ServerEntity => ({ id, kind: 'gift', updatedAt: 1, deviceId: 'A', author: 'jesus', forWhom: 'Lucía', what: 'Pendientes', where: 'Via Condotti', bought: false, ...(shared ? { shared } : {}) });
    await handlePush(s, { entities: [g('gift-sorpresa'), g('gift-comun', true)] }, 1000);
    const lucia = await handlePull(s, { since: 0, who: 'lucia' }, 2000);
    const sorpresa = lucia.entities.find((x) => x.id === 'gift-sorpresa')!;
    expect(sorpresa.what).toBeNull();
    expect(sorpresa.locked).toBe(true);
    expect(lucia.entities.find((x) => x.id === 'gift-comun')!.what).toBe('Pendientes');
    const jesus = await handlePull(s, { since: 0, who: 'jesus' }, 2000);
    expect(jesus.entities.find((x) => x.id === 'gift-sorpresa')!.what).toBe('Pendientes');
  });
});
