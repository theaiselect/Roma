// «Buscar versión nueva»: pide al service worker que mire si hay una versión más reciente de la app.
// 'new' = descargada y lista para usar · 'failed' = la hay, pero no se pudo descargar entera ·
// 'slow' = la hay y se sigue descargando (el aviso «Hay una versión nueva» saldrá al terminar).
export type UpdateResult = 'new' | 'latest' | 'failed' | 'slow' | 'offline' | 'unsupported' | 'error';

type Ending = 'installed' | 'redundant' | 'timeout';

/** Espera a que una versión que se está instalando termine (lista o fallida). */
export function waitInstalled(sw: ServiceWorker, timeoutMs: number): Promise<Ending> {
  const now = (): Ending | null => sw.state === 'redundant' ? 'redundant' : sw.state === 'installing' ? null : 'installed';
  const done = now();
  if (done) return Promise.resolve(done);
  return new Promise((res) => {
    const t = setTimeout(() => { sw.removeEventListener('statechange', on); res('timeout'); }, timeoutMs);
    function on() {
      const d = now();
      if (!d) return;
      clearTimeout(t);
      sw.removeEventListener('statechange', on);
      res(d);
    }
    sw.addEventListener('statechange', on);
  });
}

/** Algunos navegadores (Safari) resuelven `update()` antes de poner la versión nueva en `installing`. */
function nextUpdateFound(reg: ServiceWorkerRegistration, ms: number): Promise<ServiceWorker | null> {
  if (reg.installing) return Promise.resolve(reg.installing);
  return new Promise((res) => {
    const t = setTimeout(() => { reg.removeEventListener('updatefound', on); res(reg.installing); }, ms);
    function on() { clearTimeout(t); reg.removeEventListener('updatefound', on); res(reg.installing); }
    reg.addEventListener('updatefound', on);
  });
}

export async function checkForUpdate(opts: { onDownloading?: () => void; timeoutMs?: number } = {}): Promise<UpdateResult> {
  const { onDownloading, timeoutMs = 180_000 } = opts;
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (!reg) return 'unsupported';
  // Ya encontrada antes (al abrir la app): no hace falta ir a buscarla.
  if (reg.waiting) return 'new';
  const found = nextUpdateFound(reg, 2500);
  try {
    await reg.update();
  } catch {
    return navigator.onLine === false ? 'offline' : 'error';
  }
  const sw = reg.installing ?? (await found);
  if (sw) {
    onDownloading?.();
    // En el móvil la descarga de una versión puede tardar bastante más de 10 s: antes se daba por
    // «ya tienes la última» mientras aún se estaba bajando.
    const end = await waitInstalled(sw, timeoutMs);
    if (end === 'timeout') return 'slow';
    if (end === 'redundant' && !reg.waiting) return 'failed';
  }
  return reg.waiting ? 'new' : 'latest';
}

let applying = false;

/** Pasa a la versión nueva ya descargada y recarga. No depende del aviso de abajo. */
export async function applyUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const waiting = reg?.waiting;
  if (!waiting) return false;
  if (!applying) {
    applying = true;
    const reload = () => location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    // Si el móvil no avisa del cambio, se recarga igual: la versión nueva ya estará activa.
    setTimeout(reload, 4000);
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Al volver a la app (y como mucho cada 30 min) se busca versión nueva. Cuando una queda lista se llama a
 * `onWaiting` (el aviso de abajo): no se depende solo de workbox-window, que deja de escuchar tras la primera
 * versión que no ha pedido él mismo. */
export function watchForUpdates(reg: ServiceWorkerRegistration, onWaiting: () => void, everyMs = 30 * 60_000): void {
  if (reg.waiting) onWaiting();
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (sw) void waitInstalled(sw, 10 * 60_000).then(() => { if (reg.waiting) onWaiting(); });
  });
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - last < everyMs) return;
    last = Date.now();
    reg.update().catch(() => { /* sin red: ya se mirará la próxima vez */ });
  });
}
