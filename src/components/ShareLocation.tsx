import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { travellers } from '@/data/trip';
import { geoHelp, locate, type LatLng } from '@/lib/geo';
import { isIOS, pointUrl } from '@/lib/maps';
import { useSettings } from '@/lib/settings';

const FRESH_MS = 2 * 60_000;

/**
 * «Enviar mi ubicación». Los móviles solo dejan abrir el menú de compartir justo al tocar un botón, así que
 * primero se busca la posición y el toque que comparte va después (ya con la posición lista).
 * Con `autoLocate` la búsqueda empieza sola al abrir la pantalla: normalmente basta un toque.
 */
export function ShareLocation({ autoLocate = false }: { autoLocate?: boolean }) {
  const me = useSettings().profile ?? 'jesus';
  const other = travellers[me === 'jesus' ? 'lucia' : 'jesus'].name;
  const [fix, setFix] = useState<{ pos: LatLng; accuracy: number; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const find = async () => {
    setBusy(true); setMsg(null);
    const r = await locate(12_000);
    setBusy(false);
    if (!r.ok) { setMsg(geoHelp(r.reason, isIOS())); return; }
    setFix({ pos: r.pos, accuracy: r.accuracy, at: Date.now() });
  };
  useEffect(() => { if (autoLocate) void find(); }, []);

  const canShare = typeof navigator.share === 'function';
  const ready = fix && Date.now() - fix.at < FRESH_MS ? fix : null;
  const text = ready ? `Estoy aquí: ${pointUrl(ready.pos.lat, ready.pos.lng)} (precisión ${Math.round(ready.accuracy)} m)` : '';
  const share = () => {
    // Sin ningún `await` antes: el navegador solo lo permite en el mismo toque.
    if (canShare) void navigator.share({ text }).catch(() => undefined);
  };

  return (
    <div class="stack" style={{ gap: '0.3rem' }}>
      {!ready && (
        <button type="button" class="btn block" disabled={busy} onClick={() => void find()}>
          <Icon name="pin" /> {busy ? 'Buscando dónde estás…' : `Enviar mi ubicación a ${other}`}
        </button>
      )}
      {ready && (canShare
        ? <button type="button" class="btn primary block" onClick={share}><Icon name="share" /> Enviar ahora a {other}</button>
        : <a class="btn primary block" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener"><Icon name="share" /> Enviar ahora a {other} (WhatsApp)</a>)}
      {ready && <p class="small muted">Ya sé dónde estás (precisión {Math.round(ready.accuracy)} m). Toca para elegir a quién mandarlo.</p>}
      {msg && <p class="small pending">{msg}</p>}
    </div>
  );
}
