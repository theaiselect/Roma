// «Buscar versión nueva»: pide al service worker que mire si hay una versión más reciente de la app.
export type UpdateResult = 'new' | 'latest' | 'unsupported' | 'error';

export async function checkForUpdate(timeoutMs = 10_000): Promise<UpdateResult> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'unsupported';
    await reg.update();
    if (reg.installing) {
      const sw = reg.installing;
      await new Promise<void>((res) => {
        const t = window.setTimeout(res, timeoutMs);
        sw.addEventListener('statechange', () => { if (sw.state === 'installed' || sw.state === 'redundant') { window.clearTimeout(t); res(); } });
      });
    }
    return reg.waiting ? 'new' : 'latest';
  } catch {
    return 'error';
  }
}
