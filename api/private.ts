import { checkTripCode, json } from './_auth.js';
import { privateData } from './_private.js';
import { RedisStore } from './_redis.js';

// Reserva del hotel y demás datos que no deben ir dentro de la app pública: solo con el código del viaje.
export async function GET(req: Request): Promise<Response> {
  const denied = await checkTripCode(req, RedisStore.fromEnv());
  if (denied) return denied;
  return json(200, privateData);
}
