// Núcleo del servidor de sincronización. Sin dependencias de Vercel para poder probarlo.

export interface ServerEntity {
  id: string;
  kind: string;
  updatedAt: number;
  deviceId: string;
  author: 'jesus' | 'lucia';
  serverAt?: number;
  deleted?: boolean;
  locked?: boolean;
  [k: string]: unknown;
}

export interface Store {
  /** Guarda si es más nuevo (atómico). Devuelve true si se aceptó. */
  putIfNewer(e: ServerEntity): Promise<boolean>;
  changedSince(since: number): Promise<ServerEntity[]>;
  getMany(ids: string[]): Promise<ServerEntity[]>;
  listKind(kind: string): Promise<ServerEntity[]>;
  /** Cuenta fallos de código por IP; devuelve el total en la ventana. */
  failHit(ip: string): Promise<number>;
  isBlocked(ip: string): Promise<boolean>;
  block(ip: string, seconds: number): Promise<void>;
}

export const KINDS = new Set(['expense', 'check', 'diary', 'photo', 'letter', 'capsule', 'vote', 'answer', 'song', 'state', 'ticket', 'gift', 'saved']);
const MAX_ENTITY_BYTES = 64 * 1024;

export function validate(raw: unknown): ServerEntity | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length < 3 || e.id.length > 120) return null;
  if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return null;
  if (typeof e.updatedAt !== 'number' || !Number.isFinite(e.updatedAt)) return null;
  if (typeof e.deviceId !== 'string' || e.deviceId.length > 80) return null;
  if (e.author !== 'jesus' && e.author !== 'lucia') return null;
  if (JSON.stringify(e).length > MAX_ENTITY_BYTES) return null;
  const { locked: _l, serverAt: _s, ...rest } = e;
  return rest as ServerEntity;
}

// ── Hora de Roma (copia mínima para no depender del front) ──────
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function offset(ms: number): number {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - Math.floor(ms / 1000) * 1000;
}
/** 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm' en hora de Roma → ms UTC. */
export function romeInstant(s: string): number {
  const [date, time = '00:00'] = s.split('T') as [string, string?];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  return guess - offset(guess - offset(guess));
}
function nextMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return romeInstant(next);
}

/** Fecha 'YYYY-MM-DD' al final del tema de un voto o pregunta ('dinner-2026-10-31'). */
function topicDate(topic: unknown): string | null {
  const m = typeof topic === 'string' ? /(\d{4}-\d{2}-\d{2})$/.exec(topic) : null;
  return m ? m[1]! : null;
}

/**
 * Lo que puede ver quien pide (`who`) de una entidad:
 * - Cartas y cápsula: sin texto hasta `unlockAt`.
 * - Votos y respuestas del otro: ocultos hasta que `who` también haya votado/respondido,
 *   o hasta la medianoche del día siguiente en Roma.
 * - Regalos: solo los ve quien los apunta, salvo que los marque como compartidos (sorpresas).
 */
export function viewFor(e: ServerEntity, who: string | null, now: number, all: { votes: ServerEntity[]; answers: ServerEntity[] }): ServerEntity {
  if (e.kind === 'gift' && !e.deleted && e.shared !== true && e.author !== who) {
    return { ...e, forWhom: null, what: null, where: null, locked: true };
  }
  if ((e.kind === 'letter' || e.kind === 'capsule') && !e.deleted) {
    const at = typeof e.unlockAt === 'string' ? romeInstant(e.unlockAt) : 0;
    if (now < at) return { ...e, text: null, locked: true };
    return e;
  }
  if ((e.kind === 'vote' || e.kind === 'answer') && e.author !== who && !e.deleted) {
    const key = e.kind === 'vote' ? 'topic' : 'questionId';
    const list = e.kind === 'vote' ? all.votes : all.answers;
    const mine = list.some((x) => x[key] === e[key] && x.author === who && !x.deleted);
    const date = topicDate(e[key]);
    const expired = date ? now >= nextMidnight(date) : false;
    if (!mine && !expired) {
      const hidden = e.kind === 'vote' ? { choice: null } : { text: null };
      return { ...e, ...hidden, locked: true };
    }
  }
  return e;
}

/**
 * Guarda los cambios. Cada uno se sella con la hora del servidor JUSTO antes de escribirlo (no al empezar
 * el envío): así un móvil que pide novedades a la vez nunca se salta un cambio que se guardó durante su
 * petición (la consulta usa además un margen de solape).
 */
export async function handlePush(store: Store, body: unknown, now: number | (() => number)): Promise<{ accepted: { id: string; serverAt: number; updatedAt: number }[]; rejected: string[] }> {
  const list = (body as { entities?: unknown[] } | null)?.entities;
  if (!Array.isArray(list) || list.length > 100) throw new Error('bad_request');
  const clock = typeof now === 'function' ? now : (() => { let t = now; return () => t++; })();
  const accepted: { id: string; serverAt: number; updatedAt: number }[] = [];
  const rejected: string[] = [];
  let last = 0;
  for (const raw of list) {
    const e = validate(raw);
    if (!e) { rejected.push(String((raw as { id?: unknown })?.id ?? '?')); continue; }
    last = Math.max(clock(), last + 1);
    const stored = { ...e, serverAt: last };
    if (await store.putIfNewer(stored)) accepted.push({ id: e.id, serverAt: stored.serverAt, updatedAt: e.updatedAt });
    else rejected.push(e.id);
  }
  return { accepted, rejected };
}

/** Margen de solape para no perder cambios escritos en el mismo instante que un pull. */
export const PULL_OVERLAP_MS = 10_000;

export async function handlePull(store: Store, opts: { since?: number; ids?: string[]; who: string | null }, now: number): Promise<{ entities: ServerEntity[]; serverTime: number }> {
  const raw = opts.ids?.length ? await store.getMany(opts.ids.slice(0, 200)) : await store.changedSince(Math.max(0, (opts.since ?? 0) - PULL_OVERLAP_MS));
  const needsReveal = raw.some((e) => e.kind === 'vote' || e.kind === 'answer');
  const all = needsReveal
    ? { votes: await store.listKind('vote'), answers: await store.listKind('answer') }
    : { votes: [], answers: [] };
  return { entities: raw.map((e) => viewFor(e, opts.who, now, all)), serverTime: now };
}

// ── Almacén en memoria (pruebas y desarrollo local) ─────────────
export class MemoryStore implements Store {
  data = new Map<string, ServerEntity>();
  fails = new Map<string, number>();
  blocked = new Set<string>();
  async putIfNewer(e: ServerEntity): Promise<boolean> {
    const cur = this.data.get(e.id);
    if (cur && (cur.updatedAt > e.updatedAt || (cur.updatedAt === e.updatedAt && cur.deviceId >= e.deviceId))) return false;
    this.data.set(e.id, e);
    return true;
  }
  async changedSince(since: number) { return [...this.data.values()].filter((e) => (e.serverAt ?? 0) >= since).sort((a, b) => (a.serverAt ?? 0) - (b.serverAt ?? 0)); }
  async getMany(ids: string[]) { return ids.map((id) => this.data.get(id)).filter(Boolean) as ServerEntity[]; }
  async listKind(kind: string) { return [...this.data.values()].filter((e) => e.kind === kind); }
  async failHit(ip: string) { const n = (this.fails.get(ip) ?? 0) + 1; this.fails.set(ip, n); return n; }
  async isBlocked(ip: string) { return this.blocked.has(ip); }
  async block(ip: string) { this.blocked.add(ip); }
}
