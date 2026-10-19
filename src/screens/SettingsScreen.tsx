import { useEffect, useState } from 'preact/hooks';
import { travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { InstallCard, offlineReady } from '@/screens/Onboarding';
import { getMeta, outboxSize, wipeLocal } from '@/lib/db';
import { resetLocalSettings, updateSettings, useSettings } from '@/lib/settings';
import { requestSync, syncDisabledReason } from '@/lib/sync';
import { syncInfo } from '@/lib/sync-status';
import { italianVoice } from '@/lib/tts';
import { downloadBackup, restoreBackup } from '@/lib/backup';

declare const __APP_VERSION__: string;

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map(([v, l]) => <button type="button" key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function Status() {
  const [st, setSt] = useState<Record<string, string>>({});
  useEffect(() => {
    void (async () => {
      const ready = await offlineReady().catch(() => false);
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = await navigator.storage?.persisted?.().catch(() => false);
      const mapCache = 'caches' in window ? await caches.open('mapa').then((c) => c.keys()).catch(() => []) : [];
      const voice = await italianVoice();
      const last = (await getMeta<number>('lastSyncAt')) ?? syncInfo().lastSyncAt;
      const pending = await outboxSize();
      setSt({
        'Versión': __APP_VERSION__,
        'Contenido descargado': ready ? 'Sí' : 'No',
        'Mapa descargado': mapCache.length ? 'Sí' : 'No',
        'Almacenamiento persistente': persisted ? 'Sí' : 'No',
        'Espacio usado': est?.usage ? `${(est.usage / 1048576).toFixed(1)} MB` : '—',
        'Voz italiana': voice ? `Sí (${voice.name})` : 'No',
        'Cambios pendientes de enviar': String(pending),
        'Última sincronización': last ? new Date(last).toLocaleString('es-ES') : 'Nunca',
        ...(syncDisabledReason() || syncInfo().lastError ? { 'Error de sincronización': syncDisabledReason() ?? syncInfo().lastError ?? '' } : {}),
      });
    })();
  }, []);
  return (
    <table class="simple small">
      <tbody>{Object.entries(st).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

/** Ajustes (F50): todo persiste al cerrar la app. */
export function SettingsScreen() {
  const s = useSettings();
  const [code, setCode] = useState(s.tripCode ?? '');
  const [syncing, setSyncing] = useState(false);
  return (
    <div class="stack-lg">
      <BackTitle title="Ajustes" />
      <section class="card stack">
        <h2>Perfil</h2>
        <Seg label="Perfil" value={(s.profile ?? 'jesus') as Who} options={(Object.keys(travellers) as Who[]).map((w) => [w, travellers[w].name])} onChange={(v) => updateSettings({ profile: v })} />
      </section>
      <section class="card stack">
        <h2>Aspecto</h2>
        <Seg label="Tema" value={s.theme} options={[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]} onChange={(v) => updateSettings({ theme: v })} />
        <Seg label="Tamaño de letra" value={s.largeText ? 'big' : 'normal'} options={[['normal', 'Letra normal'], ['big', 'Letra grande']]} onChange={(v) => updateSettings({ largeText: v === 'big' })} />
      </section>
      <section class="card stack">
        <h2>Código del viaje</h2>
        <p class="small muted">El mismo en los dos móviles. Sin él, todo funciona pero no se comparte.</p>
        <input type="password" autoComplete="off" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} aria-label="Código del viaje" placeholder="dd/mm/aaaa" />
        <p class="small muted">Pista: nuestra fecha (dd/mm/aaaa), con o sin barras.</p>
        <button type="button" class="btn primary" disabled={code.trim().length < 6 || code.trim() === s.tripCode} onClick={() => { updateSettings({ tripCode: code.trim() }); void requestSync(true); }}>Guardar código</button>
        <button type="button" class="btn" disabled={syncing} onClick={() => { setSyncing(true); void requestSync(true).finally(() => setSyncing(false)); }}>{syncing ? 'Sincronizando…' : 'Forzar sincronización'}</button>
      </section>
      <section class="card stack">
        <h2>Estado</h2>
        <InstallCard />
        <Status />
      </section>
      <section class="card stack">
        <h2>Copia de seguridad</h2>
        <p class="small muted">Todo lo vuestro (gastos, diario, fotos, entradas, casillas) en un archivo. Guárdalo en Drive o envíatelo por WhatsApp.</p>
        <button type="button" class="btn" onClick={() => void downloadBackup()}>Exportar copia</button>
        <label class="btn ghost">
          Restaurar desde un archivo
          <input type="file" accept="application/json,.json" class="sr-only" onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            void f.text().then(restoreBackup).then((r) => alert(`Restaurado: ${r.entities} datos y ${r.blobs} archivos.`)).catch((err: Error) => alert(`No se pudo restaurar: ${err.message}`));
          }} />
        </label>
      </section>
      <section class="card stack">
        <h2>Borrar datos de este móvil</h2>
        <p class="small muted">Borra lo guardado aquí (no en el otro móvil ni en el servidor). Haz antes una copia de seguridad.</p>
        <button type="button" class="btn danger" onClick={() => {
          if (!confirm('¿Borrar todos los datos de este móvil?')) return;
          void wipeLocal().then(() => { resetLocalSettings(); location.href = '/'; });
        }}>Borrar datos locales</button>
      </section>
    </div>
  );
}
