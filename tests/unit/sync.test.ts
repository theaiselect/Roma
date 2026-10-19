import { describe, expect, it } from 'vitest';
import { handlePull, handlePush, MemoryStore, romeInstant, type ServerEntity } from '../../api/_core';
import { mergeIncoming, wins } from '@/lib/merge';
import type { Entity } from '@/lib/db';

const e = (o: Partial<ServerEntity>): ServerEntity => ({ id: 'exp-1', kind: 'expense', updatedAt: 1000, deviceId: 'A', author: 'jesus', ...o });

describe('fusión por último cambio (cliente)', () => {
  it('gana el más reciente; empate por deviceId mayor', () => {
    expect(wins({ updatedAt: 2, deviceId: 'A' }, { updatedAt: 1, deviceId: 'Z' })).toBe(true);
    expect(wins({ updatedAt: 1, deviceId: 'A' }, { updatedAt: 2, deviceId: 'Z' })).toBe(false);
    expect(wins({ updatedAt: 5, deviceId: 'B' }, { updatedAt: 5, deviceId: 'A' })).toBe(true);
    expect(wins({ updatedAt: 5, deviceId: 'A' }, { updatedAt: 5, deviceId: 'B' })).toBe(false);
  });

  it('las lápidas ganan si son más nuevas y no reaparecen', () => {
    const local = new Map<string, Entity>([['exp-1', e({ updatedAt: 1 }) as Entity]]);
    const out = mergeIncoming(local, [e({ updatedAt: 2, deleted: true }) as Entity]);
    expect(out[0]?.deleted).toBe(true);
    const again = mergeIncoming(local, [e({ updatedAt: 1 }) as Entity]);
    expect(again).toHaveLength(0);
  });
});

describe('servidor de sincronización', () => {
  it('acepta lo nuevo, rechaza lo viejo y sella serverAt', async () => {
    const s = new MemoryStore();
    const r1 = await handlePush(s, { entities: [e({ updatedAt: 10 })] }, 5000);
    expect(r1.accepted[0]).toMatchObject({ id: 'exp-1', serverAt: 5000 });
    const r2 = await handlePush(s, { entities: [e({ updatedAt: 9, deviceId: 'Z' })] }, 6000);
    expect(r2.rejected).toEqual(['exp-1']);
    const r3 = await handlePush(s, { entities: [e({ updatedAt: 10, deviceId: 'B' })] }, 7000);
    expect(r3.accepted).toHaveLength(1);
  });

  it('rechaza entidades mal formadas', async () => {
    const s = new MemoryStore();
    const r = await handlePush(s, { entities: [{ id: 'x', kind: 'hack' }, e({ author: 'eve' as 'jesus' })] }, 1);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(2);
  });

  it('el pull usa la hora del servidor, no la del móvil', async () => {
    const s = new MemoryStore();
    // Móvil con el reloj atrasado un día: su updatedAt es viejo, pero el serverAt es el de ahora.
    await handlePush(s, { entities: [e({ id: 'gasto-g1', updatedAt: 1 })] }, 100_000);
    const pull = await handlePull(s, { since: 90_000, who: 'lucia' }, 101_000);
    expect(pull.entities.map((x) => x.id)).toEqual(['gasto-g1']);
    expect(pull.serverTime).toBe(101_000);
  });

  it('un gasto hecho sin conexión en un móvil llega al otro', async () => {
    const s = new MemoryStore();
    const offline = e({ id: 'gasto-1', amountCents: 1250, author: 'jesus', updatedAt: 50 });
    await handlePush(s, { entities: [offline] }, 200_000);
    const { entities } = await handlePull(s, { since: 0, who: 'lucia' }, 201_000);
    expect(entities.find((x) => x.id === 'gasto-1')?.amountCents).toBe(1250);
  });
});

describe('revelados y cartas', () => {
  const day = '2026-10-31';
  const vote = (who: 'jesus' | 'lucia', choice: string) => e({ id: `vote:dinner-${day}:${who}`, kind: 'vote', topic: `dinner-${day}`, choice, author: who });

  it('el voto del otro no aparece hasta que votas tú', async () => {
    const s = new MemoryStore();
    const t = romeInstant(`${day}T18:00`);
    await handlePush(s, { entities: [vote('jesus', 'felice')] }, t);
    let pull = await handlePull(s, { since: 0, who: 'lucia' }, t);
    expect(pull.entities[0]).toMatchObject({ choice: null, locked: true });
    await handlePush(s, { entities: [vote('lucia', 'flavio')] }, t + 1);
    pull = await handlePull(s, { since: 0, who: 'lucia' }, t + 2);
    expect(pull.entities.find((x) => x.author === 'jesus')).toMatchObject({ choice: 'felice' });
  });

  it('a la medianoche del día siguiente se revela aunque no votes', async () => {
    const s = new MemoryStore();
    await handlePush(s, { entities: [vote('jesus', 'felice')] }, 1);
    const pull = await handlePull(s, { since: 0, who: 'lucia' }, romeInstant('2026-11-01T00:01'));
    expect(pull.entities[0]).toMatchObject({ choice: 'felice' });
  });

  it('una carta con hora futura llega con text: null', async () => {
    const s = new MemoryStore();
    const letter = e({ id: 'carta-1', kind: 'letter', to: 'lucia', text: 'Te quiero', unlockAt: '2026-11-01T16:45' });
    await handlePush(s, { entities: [letter] }, 1);
    const before = await handlePull(s, { since: 0, who: 'lucia' }, romeInstant('2026-11-01T16:00'));
    expect(before.entities[0]).toMatchObject({ text: null, locked: true });
    const after = await handlePull(s, { ids: ['carta-1'], who: 'lucia' }, romeInstant('2026-11-01T16:46'));
    expect(after.entities[0]).toMatchObject({ text: 'Te quiero' });
  });

  it('la cápsula no se abre antes del 30 de octubre de 2027', async () => {
    const s = new MemoryStore();
    await handlePush(s, { entities: [e({ id: 'cap-1', kind: 'capsule', text: 'Hola futuro', unlockAt: '2027-10-30' })] }, 1);
    expect((await handlePull(s, { since: 0, who: 'jesus' }, romeInstant('2027-10-29T23:59'))).entities[0]?.text).toBeNull();
    expect((await handlePull(s, { since: 0, who: 'jesus' }, romeInstant('2027-10-30T00:00'))).entities[0]?.text).toBe('Hola futuro');
  });
});
