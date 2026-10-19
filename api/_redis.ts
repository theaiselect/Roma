import { Redis } from '@upstash/redis';
import type { ServerEntity, Store } from './_core.js';
import { redisEnv } from './_auth.js';

// Compara-y-guarda atómico: solo escribe si (updatedAt, deviceId) es mayor que lo guardado.
const CAS = `
local cur = redis.call('HMGET', KEYS[2], 'u', 'd')
if cur[1] then
  local u = tonumber(cur[1])
  local nu = tonumber(ARGV[2])
  if u > nu or (u == nu and cur[2] >= ARGV[3]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[2], 'u', ARGV[2], 'd', ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])
redis.call('SADD', KEYS[4], ARGV[5])
return 1
`;

export class RedisStore implements Store {
  constructor(private r: Redis) {}

  static fromEnv(): RedisStore | null {
    const env = redisEnv();
    return env ? new RedisStore(new Redis({ url: env.url, token: env.token })) : null;
  }

  async putIfNewer(e: ServerEntity): Promise<boolean> {
    const res = await this.r.eval(CAS, [`e:${e.id}`, `v:${e.id}`, 'idx', `kind:${e.kind}`], [JSON.stringify(e), String(e.updatedAt), e.deviceId, String(e.serverAt ?? Date.now()), e.id]);
    return Number(res) === 1;
  }

  async changedSince(since: number): Promise<ServerEntity[]> {
    const ids = await this.r.zrange<string[]>('idx', since, '+inf', { byScore: true });
    return this.getMany(ids);
  }

  async getMany(ids: string[]): Promise<ServerEntity[]> {
    const out: ServerEntity[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      if (!chunk.length) continue;
      const vals = await this.r.mget<(ServerEntity | string | null)[]>(...chunk.map((id) => `e:${id}`));
      for (const v of vals) if (v) out.push(typeof v === 'string' ? (JSON.parse(v) as ServerEntity) : v);
    }
    return out;
  }

  async listKind(kind: string): Promise<ServerEntity[]> {
    return this.getMany(await this.r.smembers(`kind:${kind}`));
  }

  async failHit(ip: string): Promise<number> {
    const k = `rl:${ip}`;
    const n = await this.r.incr(k);
    if (n === 1) await this.r.expire(k, 60);
    return n;
  }

  async isBlocked(ip: string): Promise<boolean> {
    return (await this.r.exists(`blk:${ip}`)) === 1;
  }

  async block(ip: string, seconds: number): Promise<void> {
    await this.r.set(`blk:${ip}`, '1', { ex: seconds });
  }
}
