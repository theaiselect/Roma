import { useEffect, useState } from 'preact/hooks';
import { OfflineCard } from '@/components/OfflineCard';
import { ReadinessCard } from '@/components/Readiness';
import { travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { InstallCard, offlineReady } from '@/screens/Onboarding';
import { getMeta, outboxSize, wipeLocal } from '@/lib/db';
import { getSettings, resetLocalSettings, updateSettings, useSettings } from '@/lib/settings';
import { requestSync, syncDisabledReason } from '@/lib/sync';
import { syncInfo } from '@/lib/sync-status';
import { italianVoice } from '@/lib/tts';
import { markBackupDone, prepareBackup, restoreBackup } from '@/lib/backup';
import { canShareFile, downloadFile, FileReady } from '@/components/FileShare';
import { checkConnection, type ConnectionReport } from '@/lib/connection';
import { useLocal } from '@/lib/local';
import { useOnline } from '@/lib/online';
import { applyUpdate, checkForUpdate, type UpdateResult } from '@/lib/update';

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
        'Perfil de este móvil': travellers[getSettings().profile ?? 'jesus'].name,
        'Código del viaje guardado': getSettings().tripCode ? 'Sí' : 'No',
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

const UPDATE_TEXT: Record<UpdateResult | 'downloading', string> = {
  downloading: 'Hay una versión nueva y se está descargando. Puede tardar un poco con datos móviles.',
  new: 'Hay una versión nueva lista: pulsa «Actualizar ahora». La app se recargará y no se pierde nada.',
  latest: 'Ya tienes la última versión.',
  slow: 'Hay una versión nueva, pero va lenta. Sigue descargándose: cuando termine saldrá abajo el aviso «Hay una versión nueva».',
  failed: 'Hay una versión nueva, pero no se ha podido descargar entera. Vuelve a probar, mejor con wifi.',
  offline: 'Sin conexión no se puede buscar. Prueba cuando tengas internet.',
  unsupported: 'Este navegador no permite comprobarlo desde aquí.',
  error: 'No se ha podido comprobar. ¿Hay conexión?',
};

/** Ajustes (F50): todo persiste al cerrar la app. */
export function SettingsScreen() {
  const s = useSettings();
  const [lastBackup] = useLocal<number | null>('roma-last-backup', null);
  useEffect(() => { const id = location.hash.slice(1); if (id === 'copia' || id === 'listo') document.getElementById(id)?.scrollIntoView({ block: 'start' }); }, []);
  const [code, setCode] = useState(s.tripCode ?? '');
  const [showCode, setShowCode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [upd, setUpd] = useState<UpdateResult | 'checking' | 'downloading' | null>(null);
  const online = useOnline();
  const [preparing, setPreparing] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  // Primero se prepara (puede tardar con muchas fotos); si el móvil comparte archivos, el envío va en otro toque.
  const exportBackup = async () => {
    setPreparing(true);
    try {
      const f = await prepareBackup();
      if (canShareFile(f)) setBackupFile(f);
      else { downloadFile(f); markBackupDone(); }
    } finally { setPreparing(false); }
  };
  const profile = (s.profile ?? 'jesus') as Who;

  const test = () => {
    setTesting(true);
    setReport(null);
    void checkConnection({ tripCode: s.tripCode, profile: s.profile, online }).then(setReport).finally(() => setTesting(false));
  };
  const lookForUpdate = () => {
    setUpd('checking');
    void checkForUpdate({ onDownloading: () => setUpd('downloading') }).then(setUpd);
  };
  return (
    <div class="stack-lg">
      <BackTitle title="Ajustes" />
      <ReadinessCard />
      <section class="card stack">
        <h2>Perfil</h2>
        <Seg label="Perfil" value={profile} options={(Object.keys(travellers) as Who[]).map((w) => [w, travellers[w].name])} onChange={(v) => {
          if (v === profile) return;
          if (confirm(`Este móvil pasará a ser el de ${travellers[v].name}: lo que escribas a partir de ahora se guardará a su nombre. ¿Cambiar?`)) updateSettings({ profile: v });
        }} />
        <p class="small muted">Cada móvil con su perfil: Jesús en el suyo y Lucía en el suyo.</p>
      </section>
      <section class="card stack">
        <h2>Aspecto</h2>
        <Seg label="Tema" value={s.theme} options={[['auto', 'Automático'], ['light', 'Día (marfil)'], ['dark', 'Noche (por defecto)']]} onChange={(v) => updateSettings({ theme: v })} />
        <Seg label="Tamaño de letra" value={s.largeText ? 'big' : 'normal'} options={[['normal', 'Letra normal'], ['big', 'Letra grande']]} onChange={(v) => updateSettings({ largeText: v === 'big' })} />
      </section>
      <section class="card stack" id="codigo">
        <h2>Código del viaje</h2>
        <p class="small muted">El mismo en los dos móviles. Sin él, todo funciona pero no se comparte.</p>
        {showCode
          ? <input type="text" autoComplete="off" autoCapitalize="off" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} aria-label="Código del viaje" placeholder="dd/mm/aaaa" />
          : <input type="password" autoComplete="off" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} aria-label="Código del viaje" placeholder="dd/mm/aaaa" />}
        <label class="row small"><input type="checkbox" checked={showCode} onChange={(e) => setShowCode((e.target as HTMLInputElement).checked)} style={{ width: 22, height: 22 }} /> Mostrar el código</label>
        <p class="small muted">Pista: nuestra fecha (dd/mm/aaaa), con o sin barras.</p>
        <button type="button" class="btn primary" disabled={code.trim().length < 6 || code.trim() === s.tripCode} onClick={() => { updateSettings({ tripCode: code.trim() }); void requestSync(true); }}>Guardar código</button>
        <button type="button" class="btn" disabled={syncing} onClick={() => { setSyncing(true); void requestSync(true).finally(() => setSyncing(false)); }}>{syncing ? 'Sincronizando…' : 'Forzar sincronización'}</button>
        <button type="button" class="btn" disabled={testing} onClick={test}>{testing ? 'Comprobando…' : 'Probar conexión y código'}</button>
        {report && (
          <ul class="list small" role="status" aria-label="Resultado de la comprobación">
            {report.steps.map((st, i) => <li key={i} class="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><span class={`chip ${st.ok ? 'ok' : 'bad'}`} aria-label={st.ok ? 'Bien' : 'Falla'}>{st.ok ? '✓' : '✗'}</span><span>{st.text}</span></li>)}
          </ul>
        )}
      </section>
      <OfflineCard />
      <section class="card stack">
        <h2>Estado</h2>
        <div id="instalar"><InstallCard /></div>
        <Status />
        {upd === 'new'
          ? <button type="button" class="btn primary" onClick={() => void applyUpdate().then((ok) => { if (!ok) setUpd('latest'); })}>Actualizar ahora</button>
          : <button type="button" class="btn" disabled={upd === 'checking' || upd === 'downloading'} onClick={lookForUpdate}>{upd === 'checking' ? 'Buscando…' : upd === 'downloading' ? 'Descargando la versión nueva…' : 'Buscar versión nueva'}</button>}
        {upd && upd !== 'checking' && (
          <p class="small" role="status">{UPDATE_TEXT[upd]}</p>
        )}
      </section>
      <section class="card stack" id="copia">
        <h2>Copia de seguridad</h2>
        <p class="small" role="status">{lastBackup ? `Última copia guardada: ${new Date(lastBackup).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}.` : 'Todavía no has guardado ninguna copia en este móvil.'}</p>
        <p class="small muted">Todo lo vuestro (gastos, diario, fotos, entradas, casillas) en un archivo. Guárdalo en Drive o envíatelo por WhatsApp.</p>
        <button type="button" class="btn" disabled={preparing} onClick={() => void exportBackup()}>{preparing ? 'Preparando la copia…' : 'Exportar copia'}</button>
        {backupFile && <FileReady file={backupFile} label="Copia" onDone={() => { markBackupDone(); setBackupFile(null); }} />}
        <label class="btn ghost">
          Restaurar desde un archivo
          <input type="file" accept="application/json,.json" class="sr-only" onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const el = e.target as HTMLInputElement;
            if (!confirm('Se mezclará la copia con lo que hay en este móvil (gana siempre lo más reciente). ¿Restaurar?')) { el.value = ''; return; }
            void f.text().then(restoreBackup).then((r) => alert(`Restaurado: ${r.entities} datos y ${r.blobs} archivos.`)).catch((err: Error) => alert(`No se pudo restaurar: ${err.message}`)).finally(() => { el.value = ''; });
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
