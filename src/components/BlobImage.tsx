import { useEffect, useState } from 'preact/hooks';
import { getBlob } from '@/lib/db';
import { ensureBlob } from '@/lib/sync';

/** Imagen guardada en IndexedDB; si no está en este móvil, la descarga bajo demanda. */
export function BlobImage({ id, alt, style }: { id: string; alt: string; style?: Record<string, string> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    void (async () => {
      await ensureBlob(id).catch(() => false);
      const b = await getBlob(id);
      if (!alive) return;
      if (!b) { setMissing(true); return; }
      u = URL.createObjectURL(b);
      setUrl(u);
    })();
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  if (missing) return <div class="small muted" style={{ padding: '1rem', textAlign: 'center' }}>Foto sin descargar (hace falta conexión)</div>;
  if (!url) return <div class="progress indeterminate"><div /></div>;
  return <img src={url} alt={alt} loading="lazy" style={{ width: '100%', borderRadius: '12px', display: 'block', ...style }} />;
}
