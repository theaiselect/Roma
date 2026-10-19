import type { Entity } from '@/lib/db';

type Stamp = Pick<Entity, 'updatedAt' | 'deviceId'>;

/** ¿`a` gana a `b`? Último cambio gana; empate: gana el deviceId mayor. */
export function wins(a: Stamp, b: Stamp | undefined): boolean {
  if (!b) return true;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
  return a.deviceId > b.deviceId;
}

/** Fusiona entidades entrantes con las locales; devuelve las que hay que guardar. */
export function mergeIncoming(local: Map<string, Entity>, incoming: Entity[]): Entity[] {
  const out: Entity[] = [];
  for (const e of incoming) {
    const cur = local.get(e.id);
    if (wins(e, cur)) {
      out.push(e);
      local.set(e.id, e);
    } else if (cur && e.serverAt && cur.updatedAt === e.updatedAt && cur.deviceId === e.deviceId) {
      // Mismo cambio de vuelta del servidor: solo guardamos su sello.
      out.push({ ...cur, serverAt: e.serverAt });
    }
  }
  return out;
}
