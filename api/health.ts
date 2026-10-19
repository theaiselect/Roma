import { json, redisEnv, tripCodeConfigured } from './_auth.js';
import { blobToken } from './_blobToken.js';

// Estado de la configuración del servidor. Solo booleanos: no expone ningún secreto.
export function GET(): Response {
  return json(200, {
    ok: true,
    tripCode: tripCodeConfigured(),
    redis: Boolean(redisEnv()),
    blob: Boolean(blobToken()),
  });
}
