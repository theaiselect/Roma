import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { geoHelp, locate } from '@/lib/geo';
import { isIOS, pointUrl } from '@/lib/maps';

/** «Enviar mi ubicación»: abre WhatsApp (o el menú de compartir) con un enlace al punto exacto donde estás. */
export function ShareLocation({ label = 'Enviar mi ubicación' }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setMsg(null);
    const r = await locate(12_000);
    setBusy(false);
    if (!r.ok) { setMsg(geoHelp(r.reason, isIOS())); return; }
    const text = `Estoy aquí: ${pointUrl(r.pos.lat, r.pos.lng)} (precisión ${Math.round(r.accuracy)} m)`;
    if (navigator.share) { await navigator.share({ text }).catch(() => undefined); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (
    <div class="stack" style={{ gap: '0.3rem' }}>
      <button type="button" class="btn block" disabled={busy} onClick={() => void go()}><Icon name="pin" /> {busy ? 'Buscando dónde estás…' : label}</button>
      {msg && <p class="small pending">{msg}</p>}
    </div>
  );
}
