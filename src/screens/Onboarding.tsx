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

export function Onboarding() {
  const s = getSettings();
  const [step, setStep] = useState<Step>(s.profile ? 'code' : 'profile');
  const [code, setCode] = useState(s.tripCode ?? '');

  return (
    <main class="content stack-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
      <Logo hero />
      {step === 'profile' && <ProfileStep onPick={(who) => { updateSettings({ profile: who }); setStep('code'); }} />}
      {step === 'code' && (
        <section class="card stack">
          <h2>Código del viaje</h2>
          <p>Es la contraseña que solo sabéis los dos. Sirve para que vuestros gastos, diario y fotos se compartan entre los dos móviles y nadie más pueda verlos.</p>
          <p class="small"><b>Pista:</b> nuestra fecha. Día, mes y año, con barras: dd/mm/aaaa.</p>
          <label class="field">
            Código
            <input type="password" autoComplete="off" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="dd/mm/aaaa" inputMode="numeric" />
          </label>
          <button type="button" class="btn primary block" disabled={code.trim().length < 6}
            onClick={() => { updateSettings({ tripCode: code.trim() }); setStep(isStandalone() ? 'download' : 'install'); }}>
            Continuar
          </button>
          <button type="button" class="btn ghost block" onClick={() => setStep(isStandalone() ? 'download' : 'install')}>Lo pondré luego en Ajustes</button>
        </section>
      )}
      {step === 'install' && <InstallStep onNext={() => setStep('download')} />}
      {step === 'download' && <DownloadStep />}
    </main>
  );
}

function ProfileStep({ onPick }: { onPick: (w: Who) => void }) {
  return (
    <section class="card stack">
      <h2>¿Quién eres?</h2>
      <p class="muted">Cada móvil es de uno. Se puede cambiar en Ajustes.</p>
      {(Object.keys(travellers) as Who[]).map((w) => (
        <button type="button" key={w} class="btn block" style={{ minHeight: '3.5rem', fontSize: '1.15rem' }} onClick={() => onPick(w)}>
          {travellers[w].name}
        </button>
      ))}
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
          <li>Pulsa <b>Compartir</b> (el cuadrado con la flecha) en Safari.</li>
          <li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li>
          <li>Abre <b>Roma</b> siempre desde ese icono: Safari y la app instalada no comparten datos.</li>
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
