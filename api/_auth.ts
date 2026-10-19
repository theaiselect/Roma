import { createHash, timingSafeEqual } from 'node:crypto';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** SHA-256 en hexadecimal del código del viaje (lo que va en TRIP_CODE_HASH). */
export function hashTripCode(code: string): string {
  return createHash('sha256').update(code.trim(), 'utf8').digest('hex');
}

/**
 * Comprueba la cabecera x-trip-code contra TRIP_CODE_HASH.
 * Devuelve null si es válida, o la respuesta de error que hay que mandar.
 * (El bloqueo tras 10 fallos por minuto se añade con Redis en la fase 2.)
 */
export function checkTripCode(req: Request): Response | null {
  const expected = process.env.TRIP_CODE_HASH?.trim().toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) {
    return json(503, { error: 'not_configured', message: 'Falta TRIP_CODE_HASH en Vercel.' });
  }
  const code = req.headers.get('x-trip-code');
  if (!code) return json(401, { error: 'unauthorized' });
  const got = Buffer.from(hashTripCode(code), 'hex');
  const want = Buffer.from(expected, 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return json(401, { error: 'unauthorized' });
  return null;
}

export function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
