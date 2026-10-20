import { Redis } from '@upstash/redis';
import { json, redisEnv } from './_auth.js';

// Upstash archiva las bases gratuitas tras 30 días sin uso. La cápsula del tiempo se abre en octubre de 2027:
// Vercel llama aquí una vez por semana (vercel.json → crons) para que la base siga activa.
// No devuelve ni guarda nada privado: solo la hora de la última visita.
export async function GET(): Promise<Response> {
  const env = redisEnv();
  if (!env) return json(503, { error: 'not_configured' });
  const r = new Redis({ url: env.url, token: env.token });
  await r.set('keepalive', String(Date.now()));
  return json(200, { ok: true });
}
