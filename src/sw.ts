/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { RangeRequestsPlugin } from 'workbox-range-requests';

declare const self: ServiceWorkerGlobalScope;

// App, fuentes, iconos y datos del viaje: todo precacheado.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cualquier navegación sin red abre la app desde la caché.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Sincronización y archivos: siempre red. Si falla, la cola local se encarga.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), 'GET');
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), 'POST');

// Mapa (PMTiles, ~25 MB): caché propia + peticiones Range.
registerRoute(
  ({ url }) => url.pathname.endsWith('.pmtiles'),
  new CacheFirst({ cacheName: 'mapa', plugins: [new RangeRequestsPlugin()] }),
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
