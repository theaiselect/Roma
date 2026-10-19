import { save, useKind, type Entity } from '@/lib/db';
import type { Who } from '@/data/types';

// Casillas compartidas: una entidad por casilla (marcar dos distintas a la vez nunca choca).
export type ListId = 'legs' | 'reservations' | 'resnotes' | 'stops' | 'monuments' | 'packing' | 'nightBefore' | 'gifts';

export interface CheckEntity extends Entity {
  kind: 'check';
  listId: ListId;
  itemId: string;
  who?: Who;
  done: boolean;
  value?: string;
}

export function checkId(listId: ListId, itemId: string, who?: Who): string {
  return `check:${listId}:${itemId}${who ? `:${who}` : ''}`;
}

export function useChecks(listId: ListId): Map<string, CheckEntity> {
  const all = useKind<CheckEntity>('check') ?? [];
  const m = new Map<string, CheckEntity>();
  for (const c of all) if (c.listId === listId) m.set(c.who ? `${c.itemId}:${c.who}` : c.itemId, c);
  return m;
}

export function setCheck(listId: ListId, itemId: string, done: boolean, extra: { who?: Who; value?: string } = {}): Promise<Entity> {
  return save({ id: checkId(listId, itemId, extra.who), kind: 'check', listId, itemId, done, ...extra });
}
