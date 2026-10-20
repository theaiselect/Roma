import { del, get, put } from '@vercel/blob';
import { BLOB_ID_RE as ID_RE, MAX_BLOB_BYTES as MAX_BYTES, blobTypeOk } from './_blobRules.js';
import { checkTripCode, json } from './_auth.js';
import { blobConfigured, blobToken } from './_blobToken.js';
import { RedisStore } from './_redis.js';

// Fotos, notas de voz y entradas: Blob privado, solo a través de esta ruta y con el código del viaje.

function configured(): boolean {
  return blobConfigured();
}

export async function POST(req: Request): Promise<Response> {
  const denied = await checkTripCode(req, RedisStore.fromEnv());
  if (denied) return denied;
  if (!configured()) return json(503, { error: 'not_configured', message: 'Falta conectar el Blob store en Vercel.' });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const type = req.headers.get('content-type') ?? '';
  if (!ID_RE.test(id)) return json(400, { error: 'bad_id' });
  if (!blobTypeOk(type)) return json(415, { error: 'bad_type' });
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

/** Borra un archivo cuyo dato ya se borró (foto, entrada, nota de voz). */
export async function DELETE(req: Request): Promise<Response> {
  const denied = await checkTripCode(req, RedisStore.fromEnv());
  if (denied) return denied;
  if (!configured()) return json(503, { error: 'not_configured' });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return json(400, { error: 'bad_id' });
  try { await del(`f/${id}`, { token: blobToken() }); } catch { /* ya no estaba */ }
  return json(200, { ok: true });
}
