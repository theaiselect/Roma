import { useEffect, useState } from 'preact/hooks';
import { Logo } from '@/components/Logo';
import { travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { isIOS } from '@/lib/maps';
import { getSettings, updateSettings } from '@/lib/settings';

type Step = 'profile' | 'code' | 'install' | 'download';

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void> }
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e as BeforeInstallPromptEvent; });

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Comprueba que el service worker ya tiene la app en caché. */
export async function offlineReady(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
  await navigator.serviceWorker.ready;
  const keys = await caches.keys();
  for (const k of keys) {
    if (!k.includes('precache')) continue;
    const c = await caches.open(k);
    if ((await c.keys()).length > 5) return true;
  }
  return false;
}

/** ¿Quedan pasos antes de entrar? Contraseña → instalar (solo en el navegador) → quién eres → descarga. */
function stepAfter(from: Step | null): Step {
  const s = getSettings();
  if (from === null && !s.tripCode) return 'code';
  if ((from === null || from === 'code') && !isStandalone()) return 'install';
  if (!s.profile) return 'profile';
  return 'download';
}

type CodeCheck = 'ok' | 'wrong' | 'wait' | 'unknown';

/** Comprueba la contraseña con el servidor. Sin red o con el servidor a medias se deja pasar: se puede revisar en Ajustes. */
async function checkCode(code: string): Promise<CodeCheck> {
  try {
    const res = await fetch(`/api/sync?since=${Date.now()}`, { cache: 'no-store', headers: { 'x-trip-code': code } });
    if (res.status === 401) return 'wrong';
    if (res.status === 429) return 'wait';
    return res.ok ? 'ok' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function Onboarding() {
  const [step, setStep] = useState<Step>(() => stepAfter(null));
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 6 || checking) return;
    setChecking(true);
    setError(null);
    const r = await checkCode(c);
    setChecking(false);
    if (r === 'wrong') { setError('Esa contraseña no es. Prueba otra vez.'); return; }
    if (r === 'wait') { setError('Demasiados intentos. Espera unos minutos y vuelve a probar.'); return; }
    updateSettings({ tripCode: c });
    setStep(stepAfter('code'));
  };

  return (
    <main class="content stack-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
      <Logo hero />
      {step === 'code' && (
        <form class="card stack" onSubmit={(e) => void submit(e)}>
          <h2>Contraseña</h2>
          <label class="field">
            <span class="sr-only">Contraseña del viaje</span>
            <input type="password" autoComplete="off" autoCapitalize="off" autoFocus value={code} aria-label="Contraseña del viaje"
              onInput={(e) => { setCode((e.target as HTMLInputElement).value); setError(null); }} placeholder="dd/mm/aaaa" />
          </label>
          {error && <p class="alert danger" role="alert">{error}</p>}
          <button type="submit" class="btn primary block" disabled={code.trim().length < 6 || checking}>{checking ? 'Comprobando…' : 'Continuar'}</button>
        </form>
      )}
      {step === 'install' && <InstallStep onNext={() => setStep(stepAfter('install'))} />}
      {step === 'profile' && <ProfileStep onPick={(who) => { updateSettings({ profile: who }); setStep('download'); }} />}
      {step === 'download' && <DownloadStep />}
    </main>
  );
}

function ProfileStep({ onPick }: { onPick: (w: Who) => void }) {
  return (
    <section class="card stack">
      <h2>¿Quién eres?</h2>
      {(Object.keys(travellers) as Who[]).map((w) => (
        <button type="button" key={w} class="btn block" style={{ minHeight: '3.5rem', fontSize: '1.15rem' }} onClick={() => onPick(w)}>
          {travellers[w].name}
        </button>
      ))}
    </section>
  );
}

/** Instalación en cualquier momento (Ajustes): botón nativo si Chrome lo ofrece, o instrucciones. */
export function InstallCard() {
  const ios = isIOS();
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (isStandalone()) return <section class="card stack"><h2>Instalada</h2><p class="small muted">Estás usando Roma desde el icono de la pantalla de inicio.</p></section>;
  return (
    <section class="card stack">
      <h2>Instalar Roma</h2>
      {ios
        ? <p>En Safari: <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>.</p>
        : canPrompt
          ? <button type="button" class="btn primary block" onClick={() => void deferredPrompt?.prompt()}>Instalar aplicación</button>
          : <p>En Chrome: menú <b>⋮</b> → <b>Instalar aplicación</b> (o «Añadir a pantalla de inicio»). Si no aparece, recarga la página una vez.</p>}
    </section>
  );
}

function InstallStep({ onNext }: { onNext: () => void }) {
  const ios = isIOS();
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  return (
    <section class="card stack">
      <h2>Ponla en la pantalla de inicio</h2>
      {ios ? (
        <ol class="stack" style={{ paddingLeft: '1.2rem', margin: 0 }}>
          <li>Tiene que ser en <b>Safari</b>. Si lo has abierto desde WhatsApp u otra app, toca el icono de Safari (la brújula) o <b>···</b> → <b>Abrir en Safari</b>, y sigue allí.</li>
          <li>Pulsa <b>Compartir</b> (el cuadrado con la flecha).</li>
          <li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li>
          <li>Abre <b>Roma</b> siempre desde ese icono. La primera vez te pedirá la contraseña otra vez: Safari y la app instalada no comparten datos.</li>
        </ol>
      ) : (
        <>
          {canPrompt
            ? <button type="button" class="btn primary block" onClick={() => void deferredPrompt?.prompt()}>Instalar aplicación</button>
            : <p>En Chrome: menú <b>⋮</b> → <b>Instalar aplicación</b>.</p>}
          <p class="small muted">Después ábrela desde el icono de la pantalla de inicio.</p>
        </>
      )}
      <button type="button" class="btn block" onClick={onNext}>Ya está, seguir</button>
    </section>
  );
}

function DownloadStep() {
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = await offlineReady().catch(() => false);
      if (!alive) return;
      if (ok) {
        setReady(true);
        const p = await navigator.storage?.persist?.().catch(() => false);
        if (alive) setPersisted(Boolean(p));
      } else window.setTimeout(() => void check(), 800);
    };
    void check();
    return () => { alive = false; };
  }, []);

  return (
    <section class="card stack">
      <h2>{ready ? 'Listo para ir sin conexión' : 'Descargando el viaje…'}</h2>
      <div class={`progress${ready ? '' : ' indeterminate'}`}><div style={ready ? { width: '100%' } : undefined} /></div>
      <p class="small muted">
        {ready
          ? persisted === false ? 'El navegador no ha garantizado guardar los datos para siempre: usa siempre la app instalada.' : 'La app, los datos y los horarios ya están en este móvil.'
          : 'Mantén la conexión un momento.'}
      </p>
      <button type="button" class="btn primary block" disabled={!ready} onClick={() => updateSettings({ onboarded: true })}>Entrar</button>
      {!ready && <button type="button" class="btn ghost block" onClick={() => updateSettings({ onboarded: true })}>Entrar igualmente</button>}
    </section>
  );
}
