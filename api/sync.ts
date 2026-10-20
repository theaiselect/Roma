import { checkTripCode, json } from './_auth.js';
import { handlePull, handlePush } from './_core.js';
import { RedisStore } from './_redis.js';

function whoOf(req: Request): string | null {
  const w = req.headers.get('x-who');
  return w === 'jesus' || w === 'lucia' ? w : null;
}

export async function GET(req: Request): Promise<Response> {
  const store = RedisStore.fromEnv();
  const denied = await checkTripCode(req, store);
  if (denied) return denied;
  if (!store) return json(503, { error: 'not_configured', message: 'Falta Upstash Redis en Vercel.' });
  const url = new URL(req.url);
  const ids = url.searchParams.get('ids')?.split(',').filter(Boolean);
  const since = Number(url.searchParams.get('since') ?? 0) || 0;
  return json(200, await handlePull(store, { since, ids, who: whoOf(req) }, Date.now()));
}

export async function POST(req: Request): Promise<Response> {
  const store = RedisStore.fromEnv();
  const denied = await checkTripCode(req, store);
  if (denied) return denied;
  if (!store) return json(503, { error: 'not_configured', message: 'Falta Upstash Redis en Vercel.' });
  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_json' }); }
  try {
    return json(200, await handlePush(store, body, () => Date.now()));
  } catch {
    return json(400, { error: 'bad_request' });
  }
}
