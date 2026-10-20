import { createHash, timingSafeEqual } from 'node:crypto';
import type { Store } from './_core.js';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** SHA-256 en hexadecimal del código del viaje (lo que va en TRIP_CODE_HASH). */
export function hashTripCode(code: string): string {
  // Tolerante al teclado del móvil: mayúsculas y separadores (15/06/2026, 15-06-2026, 15.06.2026, 15062026) valen igual.
  const norm = code.trim().toLowerCase().replace(/[\s.\-/]+/g, '');
  return createHash('sha256').update(norm, 'utf8').digest('hex');
}

/**
 * Hash esperado: TRIP_CODE_HASH (SHA-256) o, si solo existe TRIP_CODE, su hash.
 * TRIP_CODE es más cómodo de poner a mano en Vercel; las dos son variables solo de servidor.
 */
function expectedHash(): string | null {
  const h = process.env.TRIP_CODE_HASH?.trim().toLowerCase();
  if (h && /^[0-9a-f]{64}$/.test(h)) return h;
  const plain = process.env.TRIP_CODE?.trim();
  return plain ? hashTripCode(plain) : null;
}

export function tripCodeConfigured(): boolean {
  return expectedHash() !== null;
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown';
}

/**
 * Comprueba la cabecera x-trip-code. Devuelve null si es válida, o la respuesta de error.
 * Con almacén: tras 30 fallos en un minuto, bloquea esa IP 5 minutos. Margen amplio porque los dos móviles
 * comparten IP en el wifi del hotel: un par de contraseñas mal escritas no deben dejar fuera al otro.
 */
export async function checkTripCode(req: Request, store?: Store | null): Promise<Response | null> {
  const expected = expectedHash();
  if (!expected) return json(503, { error: 'not_configured', message: 'Falta TRIP_CODE en Vercel.' });
  const ip = clientIp(req);
  if (store && (await store.isBlocked(ip))) return json(429, { error: 'too_many_attempts' });
  const code = req.headers.get('x-trip-code');
  const got = code ? Buffer.from(hashTripCode(code), 'hex') : Buffer.alloc(0);
  const want = Buffer.from(expected, 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    if (store && (await store.failHit(ip)) > 30) await store.block(ip, 5 * 60);
    return json(401, { error: 'unauthorized' });
  }
  return null;
}

export function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
