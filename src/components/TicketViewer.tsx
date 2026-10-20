import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { getBlob, getEntity, putBlob, save } from '@/lib/db';
import { isPdf, renderPdfPages } from '@/lib/pdf-pages';
import { ensureBlob } from '@/lib/sync';
import { onShowTicket, type TicketRef, type TicketRequest } from '@/lib/ticket-view';

/** `pages`: imágenes a pantalla completa (fotos y PDF ya pasados a imagen). `frame`: último recurso para un PDF. */
type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'pages'; urls: string[]; blob?: Blob } | { state: 'frame'; url: string; blob: Blob };

/** Comparte el archivo (hoja de compartir del móvil) o, si no se puede, lo descarga. */
export async function shareTicketFile(blob: Blob, t: TicketRef): Promise<void> {
  const file = new File([blob], t.name, { type: t.mime });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: t.name }).catch(() => undefined); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = t.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Entrada a pantalla completa sobre fondo blanco (para que el lector de QR la lea) y con la pantalla encendida. */
export function TicketViewer() {
  const [req, setReq] = useState<TicketRequest | null>(null);
  const [i, setI] = useState(0);
  const [file, setFile] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => onShowTicket((r) => { setReq(r); setI(r.index); }), []);

  const t = req?.items[i];
  useEffect(() => {
    if (!t) return;
    let alive = true;
    const urls: string[] = [];
    const url = (b: Blob) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
    setFile({ state: 'loading' });
    void (async () => {
      // 1) Páginas ya convertidas (llegan también al otro móvil y funcionan sin conexión).
      if (t.pageBlobIds?.length) {
        const pages: Blob[] = [];
        for (const id of t.pageBlobIds) { await ensureBlob(id).catch(() => false); const b = await getBlob(id); if (b) pages.push(b); }
        if (!alive) return;
        if (pages.length === t.pageBlobIds.length) { setFile({ state: 'pages', urls: pages.map(url), blob: await getBlob(t.blobId) }); return; }
      }
      await ensureBlob(t.blobId).catch(() => false);
      const blob = await getBlob(t.blobId);
      if (!alive) return;
      if (!blob) { setFile({ state: 'missing' }); return; }
      if (!isPdf(t.mime, t.name)) { setFile({ state: 'pages', urls: [url(blob)], blob }); return; }
      // 2) PDF sin páginas (añadido antes de esta versión): se convierte aquí y se guarda para los dos móviles.
      try {
        const pages = await renderPdfPages(blob);
        if (!alive) return;
        if (!pages.length) throw new Error('PDF vacío');
        setFile({ state: 'pages', urls: pages.map(url), blob });
        const ids = await Promise.all(pages.map((p) => putBlob(p)));
        const ent = await getEntity(t.id);
        if (ent && !ent.deleted) await save({ ...ent, pageBlobIds: ids });
      } catch {
        if (alive) setFile({ state: 'frame', url: url(blob), blob });
      }
    })();
    return () => { alive = false; for (const u of urls) URL.revokeObjectURL(u); };
  }, [t?.id, t?.blobId, attempt]);

  // Pantalla encendida mientras se enseña la entrada (si el navegador lo permite).
  useEffect(() => {
    if (!req) return;
    let gone = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((l) => { if (gone) void l.release(); else lock.current = l; }).catch(() => undefined);
    return () => { gone = true; void lock.current?.release().catch(() => undefined); lock.current = null; };
  }, [req]);

  useEffect(() => {
    if (!req) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setReq(null); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [req]);

  if (!req || !t) return null;
  const many = req.items.length > 1;

  return (
    <div class="ticketview" role="dialog" aria-modal="true" aria-label={`Entrada: ${t.name}`}>
      <div class="ticketview-bar">
        <button type="button" class="btn" onClick={() => setReq(null)}><Icon name="back" /> Cerrar</button>
        <span class="small num">{many ? `${i + 1} de ${req.items.length} · ` : ''}{t.name.length > 26 ? `${t.name.slice(0, 24)}…` : t.name}</span>
        {(file.state === 'pages' || file.state === 'frame') && file.blob && <button type="button" class="btn" aria-label="Compartir" onClick={() => void shareTicketFile(file.blob!, t)}><Icon name="share" /></button>}
      </div>
      <div class="ticketview-body">
        {file.state === 'loading' && <div class="progress indeterminate" style={{ width: '60%' }}><div /></div>}
        {file.state === 'missing' && (
          <div class="stack" style={{ textAlign: 'center', maxWidth: '22rem' }}>
            <p><b>Este archivo aún no está en este móvil.</b></p>
            <p class="small">Conéctate un momento (wifi o datos) y vuelve a intentarlo; después se podrá abrir sin conexión.</p>
            <button type="button" class="btn primary" onClick={() => setAttempt(attempt + 1)}>Reintentar</button>
          </div>
        )}
        {file.state === 'pages' && (
          <div class="ticketview-pages">
            {file.urls.map((u, n) => <img key={u} src={u} alt={file.urls.length > 1 ? `Entrada ${t.name}, página ${n + 1}` : `Entrada ${t.name}`} class="ticketview-img" />)}
          </div>
        )}
        {file.state === 'frame' && (
          <div class="stack" style={{ width: '100%', height: '100%' }}>
            <iframe src={file.url} title={t.name} class="ticketview-pdf" />
            <p class="small muted" style={{ textAlign: 'center' }}>Si no se ve bien, usa el botón de compartir de arriba para abrirlo con otra app.</p>
          </div>
        )}
      </div>
      {many && (
        <div class="ticketview-bar">
          <button type="button" class="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" /> Anterior</button>
          <button type="button" class="btn" disabled={i === req.items.length - 1} onClick={() => setI(i + 1)}>Siguiente <Icon name="chevron" /></button>
        </div>
      )}
    </div>
  );
}
