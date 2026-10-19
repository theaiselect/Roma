import { get, put } from '@vercel/blob';
import { checkTripCode, json } from './_auth.js';
import { blobToken } from './_blobToken.js';
import { RedisStore } from './_redis.js';

// Fotos, notas de voz y entradas: Blob privado, solo a través de esta ruta y con el código del viaje.
const ID_RE = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 4 * 1024 * 1024; // límite de cuerpo de las funciones de Vercel: 4,5 MB
const TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf|audio\/(webm|mp4|mpeg|ogg|aac|x-m4a))(;.*)?$/i;

function configured(): boolean {
  return Boolean(blobToken());
}

export async function POST(req: Request): Promise<Response> {
  const denied = await checkTripCode(req, RedisStore.fromEnv());
  if (denied) return denied;
  if (!configured()) return json(503, { error: 'not_configured', message: 'Falta conectar el Blob store en Vercel.' });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const type = req.headers.get('content-type') ?? '';
  if (!ID_RE.test(id)) return json(400, { error: 'bad_id' });
  if (!TYPES.test(type)) return json(415, { error: 'bad_type' });
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json(413, { error: 'too_large' });
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json(413, { error: 'too_large' });
  await put(`f/${id}`, buf, { access: 'private', contentType: type.split(';')[0], addRandomSuffix: false, allowOverwrite: true, token: blobToken() });
  return json(200, { ok: true, id });
}

export async function GET(req: Request): Promise<Response> {
  const denied = await checkTripCode(req, RedisStore.fromEnv());
  if (denied) return denied;
  if (!configured()) return json(503, { error: 'not_configured' });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return json(400, { error: 'bad_id' });
  const res = await get(`f/${id}`, { access: 'private', token: blobToken() });
  if (!res || res.statusCode !== 200) return json(404, { error: 'not_found' });
  return new Response(res.stream, {
    status: 200,
    headers: { 'content-type': res.blob.contentType, 'cache-control': 'private, no-store' },
  });
}
