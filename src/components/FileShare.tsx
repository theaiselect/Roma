import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';

/** ¿Este móvil puede compartir este archivo con su menú de compartir? */
export const canShareFile = (f: File): boolean => typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

/** Descarga un archivo (sin menú de compartir). */
export function downloadFile(f: File): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Archivo ya preparado: «Compartir» (WhatsApp, Drive…) y «Descargar». Va en un segundo toque porque el móvil
 * solo deja abrir el menú de compartir justo al tocar, y preparar el archivo puede tardar.
 */
export function FileReady({ file, label, onDone }: { file: File; label: string; onDone?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  const share = () => {
    // Sin `await` antes: el permiso de compartir dura solo lo que dura el toque.
    void navigator.share({ files: [file], title: label }).then(() => onDone?.()).catch(() => undefined);
  };
  return (
    <div class="row" role="status">
      <span class="small">{label} lista:</span>
      <button type="button" class="btn primary" onClick={share}><Icon name="share" /> Compartir</button>
      {url && <a class="btn" href={url} download={file.name} onClick={() => onDone?.()}><Icon name="backup" /> Descargar</a>}
    </div>
  );
}
