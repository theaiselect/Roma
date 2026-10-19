import { checkTripCode, json } from './_auth.js';

// Fase 0: ruta protegida por el código del viaje. La sincronización (Upstash Redis) llega en la fase 2.
export function GET(req: Request): Response {
  return checkTripCode(req) ?? json(501, { error: 'not_implemented', phase: 2 });
}

export function POST(req: Request): Response {
  return checkTripCode(req) ?? json(501, { error: 'not_implemented', phase: 2 });
}
