// Servidor de pruebas e2e: la app tal cual + /api/* en memoria (sin Redis ni Blob). Código del viaje: "testtest".
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config';

process.env.TRIP_CODE = 'testtest';

function memoryApi(): Plugin {
  return {
    name: 'memory-api',
    configureServer(server) {
      const blobs = new Map<string, { type: string; buf: Buffer }>();
      let core: typeof import('./api/_core') | undefined;
      let auth: typeof import('./api/_auth') | undefined;
      let store: InstanceType<typeof import('./api/_core').MemoryStore> | undefined;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        core ??= (await server.ssrLoadModule('/api/_core.ts')) as typeof core;
        auth ??= (await server.ssrLoadModule('/api/_auth.ts')) as typeof auth;
        store ??= new core!.MemoryStore();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = Buffer.concat(chunks);
        const headers = new Headers(req.headers as Record<string, string>);
        const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body });
        const send = async (r: Response) => {
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        };
        if (url.pathname === '/api/health') return send(auth!.json(200, { ok: true, tripCode: true, redis: true, blob: true }));
        const denied = await auth!.checkTripCode(request, store);
        if (denied) return send(denied);
        if (url.pathname === '/api/sync') {
          if (req.method === 'GET') {
            const ids = url.searchParams.get('ids')?.split(',').filter(Boolean);
            const who = headers.get('x-who');
            return send(auth!.json(200, await core.handlePull(store, { since: Number(url.searchParams.get('since') ?? 0) || 0, ids, who: who === 'jesus' || who === 'lucia' ? who : null }, Date.now())));
          }
          return send(auth!.json(200, await core.handlePush(store, JSON.parse(body.toString() || '{}'), () => Date.now())));
        }
        if (url.pathname === '/api/private') {
          const priv = (await server.ssrLoadModule('/api/_private.ts')) as typeof import('./api/_private');
          return send(auth!.json(200, priv.privateData));
        }
        if (url.pathname === '/api/blob') {
          const rules = (await server.ssrLoadModule('/api/_blobRules.ts')) as typeof import('./api/_blobRules');
          const id = url.searchParams.get('id') ?? '';
          if (req.method === 'DELETE') { blobs.delete(id); return send(auth!.json(200, { ok: true })); }
          if (req.method === 'POST') {
            const type = headers.get('content-type') ?? '';
            if (!rules.blobTypeOk(type)) return send(auth!.json(415, { error: 'bad_type' }));
            if (body.length > rules.MAX_BLOB_BYTES) return send(auth!.json(413, { error: 'too_large' }));
            blobs.set(id, { type, buf: body });
            return send(auth!.json(200, { ok: true, id }));
          }
          const b = blobs.get(id);
          return send(b ? new Response(b.buf, { headers: { 'content-type': b.type } }) : auth!.json(404, { error: 'not_found' }));
        }
        return send(auth!.json(404, { error: 'not_found' }));
      });
    },
  };
}

export default mergeConfig(base, defineConfig({ plugins: [memoryApi()], server: { port: 5199, strictPort: true, host: '127.0.0.1' } }));
