import { useEffect } from 'preact/hooks';

/** Pantalla completa con una frase en letra enorme para enseñársela a alguien (taxista, camarero…). */
export function ShowCard({ it, es, onClose }: { it: string; es?: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div class="showcard" role="dialog" aria-modal="true" aria-label="Texto en letra grande" onClick={onClose}>
      <p lang="it">{it}</p>
      {es && <p class="small">{es}</p>}
      <button type="button" class="btn" onClick={onClose}>Cerrar</button>
    </div>
  );
}
