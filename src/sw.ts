/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// App, fuentes, iconos y datos del viaje: todo precacheado.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cualquier navegación sin red abre la app desde la caché.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Sincronización y archivos: siempre red. Si falla, la cola local se encarga.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), 'GET');
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), 'POST');

// Mapa (OpenFreeMap). El estilo y el TileJSON se FIJAN: se sirve siempre la versión guardada, porque
// OpenFreeMap publica teselas nuevas cada semana con otra dirección y, si el TileJSON se actualizara solo,
// el mapa pediría teselas que no están descargadas. Solo la descarga de Roma los cambia (pide con `reload`).
const pinned = ({ url }: { url: URL }) => url.hostname === 'tiles.openfreemap.org' && (/^\/styles\//.test(url.pathname) || /^\/planet(\/latest)?\/?$/.test(url.pathname));
registerRoute(pinned, async ({ request }) => {
  const cache = await caches.open('mapa');
  if (request.cache === 'reload') return fetch(request);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request.url, res.clone());
  return res;
});
// Teselas, iconos y letras: una vez guardados no cambian (cada versión tiene su dirección).
registerRoute(
  ({ url }) => url.hostname === 'tiles.openfreemap.org' && /^\/(planet\/|fonts\/|sprites\/)/.test(url.pathname),
  new CacheFirst({ cacheName: 'mapa' }),
);
registerRoute(
  ({ url }) => url.hostname === 'tiles.openfreemap.org',
  new StaleWhileRevalidate({ cacheName: 'mapa' }),
);

// Tiempo (Open-Meteo): red primero, última previsión guardada 24 h.
registerRoute(
  ({ url }) => url.hostname === 'api.open-meteo.com',
  new NetworkFirst({ cacheName: 'tiempo', plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 86_400 })] }),
);

// La app nunca se recarga sola: espera a que el usuario pulse «Actualizar».
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
