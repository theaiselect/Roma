import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { travellers } from '@/data/trip';
import { isStandalone, offlineReady } from '@/screens/Onboarding';
import { runAuto, stagesNeeded, useAutoOffline } from '@/lib/auto-offline';
import { checkConnection } from '@/lib/connection';
import { db, DB_EVENT, getMeta, outboxSize } from '@/lib/db';
import { liveBlobIds } from '@/lib/blob-refs';
import { offlineStatus } from '@/lib/offline-data';
import { usePartnerSeen } from '@/lib/presence';
import { failing, readinessChecks, type Check, type ReadyInput } from '@/lib/readiness';
import { getSettings, useSettings } from '@/lib/settings';
import { requestSync } from '@/lib/sync';
import { syncInfo } from '@/lib/sync-status';
import { useOnline } from '@/lib/online';

/** Estado de este móvil leído de lo guardado (sin red). Se refresca al cambiar datos, sincronizar o descargar. */
export function useReadiness(server: ReadyInput['server'] = null): Check[] {
  const s = useSettings();
  const auto = useAutoOffline();
  const partnerWho = s.profile === 'lucia' ? 'jesus' : 'lucia';
  const seenAt = usePartnerSeen(partnerWho);
  const [local, setLocal] = useState<Pick<ReadyInput, 'pending' | 'lastSyncAt' | 'swReady' | 'persisted' | 'missing' | 'unshared'> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    for (const e of [DB_EVENT, 'roma-sync-change', 'online']) window.addEventListener(e, on);
    return () => { for (const e of [DB_EVENT, 'roma-sync-change', 'online']) window.removeEventListener(e, on); };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [st, pending, sw, persisted, last] = await Promise.all([
        offlineStatus().catch(() => null),
        outboxSize().catch(() => 0),
        // Sin service worker (modo desarrollo o navegador antiguo) `ready` no llega nunca: se corta a los 1,5 s.
        Promise.race([offlineReady().catch(() => false), new Promise<boolean>((r) => window.setTimeout(() => r(false), 1500))]),
        navigator.storage?.persisted?.().catch(() => null) ?? Promise.resolve(null),
        getMeta<number>('lastSyncAt').catch(() => undefined),
      ]);
      const d = await db();
      const need = liveBlobIds(await d.getAll('entities'), true);
      const unshared = (await d.getAll('blobs')).filter((b) => b.uploadError && need.has(b.id)).length;
      if (!alive) return;
      setLocal({
        pending, swReady: sw, persisted: persisted ?? null, unshared,
        lastSyncAt: last ?? syncInfo().lastSyncAt,
        missing: st ? stagesNeeded(st, Date.now()) : [],
      });
    })();
    return () => { alive = false; };
  }, [tick, auto.phase, auto.done]);

  if (!local) return [];
  return readinessChecks({
    now: Date.now(), installed: isStandalone(), hasCode: !!s.tripCode, server,
    partner: { name: travellers[partnerWho].name, seenAt }, ...local,
  });
}

/** Aviso en «Hoy» solo si algo importante no está listo. */
export function ReadyAlert() {
  const bad = failing(useReadiness());
  if (!bad.length) return null;
  return (
    <a class="alert" href="/mas/ajustes#listo" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Icon name="alert" />
      <span><b>{bad.length === 1 ? 'Falta 1 cosa por dejar lista' : `Faltan ${bad.length} cosas por dejar listas`}</b><br /><span class="small muted">{bad.map((b) => b.title).join(' · ')}. Toca para revisarlo.</span></span>
    </a>
  );
}

/** «¿Está todo listo?»: lista de comprobaciones de este móvil con un botón para cada arreglo posible. */
export function ReadinessCard() {
  const online = useOnline();
  const s = useSettings();
  const [server, setServer] = useState<ReadyInput['server']>(null);
  const [testing, setTesting] = useState(false);
  const checks = useReadiness(server);

  const run = async () => {
    setTesting(true);
    const r = await checkConnection({ tripCode: getSettings().tripCode, profile: getSettings().profile, online });
    const bad = r.steps.find((x) => !x.ok);
    setServer({ ok: r.ok, text: bad?.text ?? 'La contraseña es correcta y el servidor responde.' });
    if (r.ok) await requestSync(true).catch(() => undefined);
    setTesting(false);
  };

  const fix = (c: Check) => {
    if (c.fix === 'download') void runAuto(true);
    else if (c.fix === 'sync') void requestSync(true);
    else if (c.fix === 'install') document.getElementById('instalar')?.scrollIntoView({ block: 'center' });
    else if (c.fix === 'code') document.getElementById('codigo')?.scrollIntoView({ block: 'center' });
  };
  const fixLabel = (c: Check) => c.fix === 'download' ? 'Guardar ya' : c.fix === 'sync' ? 'Sincronizar' : c.fix === 'install' ? 'Cómo instalarla' : c.fix === 'code' ? 'Revisar código' : null;

  const bad = failing(checks);
  return (
    <section class="card stack" id="listo" aria-label="¿Está todo listo?">
      <div class="spread">
        <h2>¿Está todo listo?</h2>
        {checks.length > 0 && <span class={`chip ${bad.length ? 'warn' : 'ok'}`}>{bad.length ? `${bad.length} por revisar` : 'Todo listo'}</span>}
      </div>
      <p class="small muted">Comprobación de este móvil ({s.profile === 'lucia' ? 'Lucía' : 'Jesús'}). Hacedla los dos con wifi antes de salir.</p>
      <ul class="list" role="list">
        {checks.map((c) => (
          <li key={c.id} class="leg" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <span class={`chip ${c.ok ? 'ok' : c.critical ? 'bad' : 'warn'}`} aria-label={c.ok ? 'Bien' : 'Falta'}>{c.ok ? '✓' : '✗'}</span>
            <div class="stack" style={{ gap: '0.2rem' }}>
              <b>{c.title}</b>
              <span class="small muted">{c.detail}</span>
              {!c.ok && fixLabel(c) && <button type="button" class="btn" style={{ justifySelf: 'start', minHeight: '44px' }} onClick={() => fix(c)}>{fixLabel(c)}</button>}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" class="btn primary block" disabled={testing} onClick={() => void run()}>{testing ? 'Comprobando…' : 'Comprobar ahora con el servidor'}</button>
    </section>
  );
}
