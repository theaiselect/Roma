import { useEffect, useRef, useState } from 'preact/hooks';
import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { getBlob, useKind } from '@/lib/db';
import { compressImage } from '@/lib/image';
import type { PhotoEntity } from '@/screens/us-photos';

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

/** Dibuja la postal: foto, texto y sello de Roma. Devuelve un PNG. */
export async function drawPostcard(photo: Blob, text: string): Promise<Blob> {
  await document.fonts?.load('600 64px "Cormorant Garamond"').catch(() => undefined);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#F7F3EE';
  ctx.fillRect(0, 0, W, H);
  // Foto recortada al centro
  const bmp = await createImageBitmap(photo);
  const box = { x: 60, y: 60, w: W - 120, h: 860 };
  const s = Math.max(box.w / bmp.width, box.h / bmp.height);
  const sw = box.w / s, sh = box.h / s;
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
  bmp.close();
  // Texto
  ctx.fillStyle = '#2B2522';
  ctx.font = '600 56px "Cormorant Garamond", Georgia, serif';
  const lines = wrap(ctx, text || 'Roma, al revés, es amor.', W - 360).slice(0, 5);
  lines.forEach((l, i) => ctx.fillText(l, 60, 1010 + i * 64));
  // Sello
  const cx = W - 160, cy = 1110;
  ctx.strokeStyle = '#C0583A';
  ctx.lineWidth = 6;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(cx - 100, cy - 120, 200, 240);
  ctx.setLineDash([]);
  ctx.fillStyle = '#C0583A';
  ctx.textAlign = 'center';
  ctx.font = '600 62px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('ROMA', cx, cy - 10);
  ctx.font = '600 30px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('♥ AMOR ♥', cx, cy + 40);
  ctx.fillText('MMXXVI', cx, cy + 85);
  ctx.textAlign = 'left';
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** Postal digital (F46): foto + texto + sello de Roma, para compartir. */
export function Postcard() {
  const photos = useKind<PhotoEntity>('photo') ?? [];
  const [chosen, setChosen] = useState<Blob | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [out, setOut] = useState<Blob | null>(null);
  const url = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);

  const make = async () => {
    if (!chosen) return;
    const png = await drawPostcard(chosen, text.trim());
    setOut(png);
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(png);
    setPreview(url.current);
  };

  const share = async () => {
    if (!out) return;
    const file = new File([out], 'postal-roma.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Postal desde Roma' }).catch(() => undefined);
    else { const a = document.createElement('a'); a.href = preview!; a.download = file.name; a.click(); }
  };

  return (
    <section class="stack">
      <p class="small muted">Elige una foto, escribe unas líneas y compártela por WhatsApp.</p>
      <label class="btn">
        <Icon name="camera" /> Usar una foto del móvil
        <input type="file" accept="image/*" class="sr-only" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { setChosen(await compressImage(f)); setChosenId(null); } }} />
      </label>
      {photos.length > 0 && (
        <div class="scroll-row legend" style={{ gap: '0.5rem' }}>
          {photos.slice(0, 20).map((p) => (
            <button type="button" key={p.id} style={{ width: '84px', padding: 0, border: chosenId === p.id ? '3px solid var(--terracotta)' : '1px solid var(--linea)', borderRadius: '12px', background: 'none' }}
              onClick={async () => { const b = await getBlob(p.blobId); if (b) { setChosen(b); setChosenId(p.id); } }} aria-label={p.caption || 'Foto'}>
              <BlobImage id={p.blobId} alt="" style={{ aspectRatio: '1', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
      <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Desde Roma, con amor…" aria-label="Texto de la postal" />
      <button type="button" class="btn primary" disabled={!chosen} onClick={() => void make()}>Crear postal</button>
      {preview && (
        <>
          <img src={preview} alt="Vista previa de la postal" style={{ width: '100%', borderRadius: '12px', boxShadow: 'var(--sombra)' }} />
          <button type="button" class="btn primary" onClick={() => void share()}><Icon name="share" /> Compartir</button>
        </>
      )}
    </section>
  );
}
