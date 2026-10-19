import { json, redisEnv } from './_auth.js';

// Estado de la configuración del servidor. Solo booleanos: no expone ningún secreto.
export function GET(): Response {
  return json(200, {
    ok: true,
    tripCode: Boolean(process.env.TRIP_CODE_HASH),
    redis: Boolean(redisEnv()),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}
