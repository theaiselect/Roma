import { useEffect, useRef, useState } from 'preact/hooks';
import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { travellers } from '@/data/trip';
import { appNow } from '@/lib/clock';
import { getBlob, useKind } from '@/lib/db';
import { compressImage } from '@/lib/image';
import { useSettings } from '@/lib/settings';
import type { PhotoEntity } from '@/screens/us-photos';

const W = 1080;
const H = 1350;
export const MAX_POSTCARD_CHARS = 180;

export type PostcardStyle = 'clasica' | 'noche' | 'terracota';
export const POSTCARD_STYLES: Record<PostcardStyle, { label: string; bg: string; ink: string; accent: string }> = {
  clasica: { label: 'Clásica', bg: '#F7F3EE', ink: '#2B2522', accent: '#C0583A' },
  noche: { label: 'Noche', bg: '#26201D', ink: '#F7F3EE', accent: '#E0A458' },
  terracota: { label: 'Terracota', bg: '#C0583A', ink: '#FFF8F0', accent: '#FFF8F0' },
};

export interface PostcardOptions { style?: PostcardStyle; from?: string; dateText?: string }

/** Parte el texto en líneas que caben en `maxW`; respeta los saltos de línea del autor. */
export function wrapText(measure: (s: string) => number, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (measure(t) > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

/** Dibuja la postal: foto, texto (se reduce la letra si es largo), fecha, firma y sello de Roma. Devuelve un PNG. */
export async function drawPostcard(photo: Blob, text: string, opts: PostcardOptions = {}): Promise<Blob> {
  const st = POSTCARD_STYLES[opts.style ?? 'clasica'];
  await document.fonts?.load('600 64px "Cormorant Garamond"').catch(() => undefined);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, W, H);
  // Foto recortada al centro
  const bmp = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const box = { x: 60, y: 60, w: W - 120, h: 860 };
  const s = Math.max(box.w / bmp.width, box.h / bmp.height);
  const sw = box.w / s, sh = box.h / s;
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
  bmp.close();
  // Texto: se prueba de mayor a menor tamaño hasta que quepa (6 líneas como mucho en letra pequeña).
  ctx.fillStyle = st.ink;
  const body = text || 'Roma, al revés, es amor.';
  let size = 56;
  let lines: string[] = [];
  for (const sz of [56, 50, 44, 40, 36, 32]) {
    size = sz;
    ctx.font = `600 ${sz}px "Cormorant Garamond", Georgia, serif`;
    lines = wrapText((t) => ctx.measureText(t).width, body, W - 360);
    if (lines.length <= (sz >= 44 ? 5 : 6)) break;
  }
  lines = lines.slice(0, 6);
  lines.forEach((l, i) => ctx.fillText(l, 60, 1000 + i * Math.round(size * 1.15)));
  // Fecha y firma
  const footer = [opts.dateText, opts.from ? `— ${opts.from}` : ''].filter(Boolean).join(' ');
  if (footer) {
    ctx.fillStyle = st.accent;
    ctx.font = '600 30px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(footer, 60, H - 44);
  }
  // Sello
  const cx = W - 160, cy = 1110;
  ctx.strokeStyle = st.accent;
  ctx.lineWidth = 6;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(cx - 100, cy - 120, 200, 240);
  ctx.setLineDash([]);
  ctx.fillStyle = st.accent;
  ctx.textAlign = 'center';
  ctx.font = '600 62px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('ROMA', cx, cy - 10);
  ctx.font = '600 30px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('♥ AMOR ♥', cx, cy + 40);
  ctx.fillText('MMXXVI', cx, cy + 85);
  ctx.textAlign = 'left';
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))), 'image/png'));
}

/** Postal digital (F46): foto + texto + sello de Roma, para compartir. La vista previa se actualiza sola. */
export function Postcard() {
  const me = useSettings().profile ?? 'jesus';
  const photos = (useKind<PhotoEntity>('photo') ?? []).slice().sort((a, b) => b.takenAt - a.takenAt);
  const [chosen, setChosen] = useState<Blob | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<PostcardStyle>('clasica');
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);

  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    const t = window.setTimeout(() => {
      setBusy(true);
      const dateText = new Date(appNow()).toLocaleDateString('es-ES', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric' });
      drawPostcard(chosen, text.trim(), { style, from: travellers[me].name, dateText })
        .then((png) => {
          if (!alive) return;
          setOut(png); setError(null);
          if (url.current) URL.revokeObjectURL(url.current);
          url.current = URL.createObjectURL(png);
          setPreview(url.current);
        })
        .catch(() => { if (alive) setError('No se ha podido leer esa foto. Prueba con otra.'); })
        .finally(() => { if (alive) setBusy(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [chosen, text, style, me]);

  const file = () => (out ? new File([out], 'postal-roma.png', { type: 'image/png' }) : null);
  const share = async () => {
    const f = file();
    if (!f) return;
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'Postal desde Roma' }).catch(() => undefined);
    else download();
  };
  const download = () => {
    const f = file();
    if (!f || !preview) return;
    const a = document.createElement('a'); a.href = preview; a.download = f.name; a.click();
  };

  return (
    <section class="stack">
      <p class="small muted">Elige una foto, escribe unas líneas y compártela por WhatsApp.</p>
      <label class="btn">
        <Icon name="camera" /> Usar una foto del móvil
        <input type="file" accept="image/*" class="sr-only" onChange={async (e) => { const el = e.target as HTMLInputElement; const f = el.files?.[0]; if (f) { setChosen(await compressImage(f)); setChosenId(null); } el.value = ''; }} />
      </label>
      {photos.length > 0 && (
        <div class="scroll-row legend" style={{ gap: '0.5rem' }}>
          {photos.slice(0, 20).map((p) => (
            <button type="button" key={p.id} style={{ width: '84px', padding: 0, border: chosenId === p.id ? '3px solid var(--terracotta)' : '1px solid var(--linea)', borderRadius: '12px', background: 'none' }}
              aria-pressed={chosenId === p.id}
              onClick={async () => { const b = await getBlob(p.blobId); if (b) { setChosen(b); setChosenId(p.id); } }} aria-label={p.caption || 'Foto'}>
              <BlobImage id={p.blobId} alt="" style={{ aspectRatio: '1', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
      <textarea value={text} maxLength={MAX_POSTCARD_CHARS} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Desde Roma, con amor…" aria-label="Texto de la postal" />
      <p class="small muted num" style={{ textAlign: 'right' }}>{text.length} / {MAX_POSTCARD_CHARS}</p>
      <div class="segmented" role="group" aria-label="Estilo de la postal">
        {(Object.keys(POSTCARD_STYLES) as PostcardStyle[]).map((k) => <button type="button" key={k} aria-pressed={style === k} onClick={() => setStyle(k)}>{POSTCARD_STYLES[k].label}</button>)}
      </div>
      {!chosen && <p class="small muted">Elige una foto para ver la postal.</p>}
      {error && <p class="small pending" role="alert">{error}</p>}
      {preview && (
        <>
          <img src={preview} alt="Vista previa de la postal" style={{ width: '100%', borderRadius: '12px', boxShadow: 'var(--sombra)', opacity: busy ? 0.7 : 1 }} />
          <div class="row">
            <button type="button" class="btn primary" onClick={() => void share()}><Icon name="share" /> Compartir</button>
            <button type="button" class="btn" onClick={download}><Icon name="backup" /> Guardar imagen</button>
          </div>
        </>
      )}
    </section>
  );
}
