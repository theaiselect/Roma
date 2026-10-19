import { checkTripCode, json } from './_auth.js';

// Fase 0: ruta protegida por el código del viaje. Fotos, notas de voz y entradas (Blob privado) llegan en la fase 2.
export function GET(req: Request): Response {
  return checkTripCode(req) ?? json(501, { error: 'not_implemented', phase: 2 });
}

export function POST(req: Request): Response {
  return checkTripCode(req) ?? json(501, { error: 'not_implemented', phase: 2 });
}
