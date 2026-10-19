import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import type { Place } from '@/data/types';
import { appNow } from '@/lib/clock';
import { arrival, formatDistance, geoHelp, locate, walkingDistanceM } from '@/lib/geo';
import { isIOS } from '@/lib/maps';
import { romeParts } from '@/lib/time';

/** ¿Llego a tiempo? (F05): distancia a pie y hora estimada de llegada. */
export function ArrivalButton({ place, at }: { place: Place; at: number | null }) {
  const [msg, setMsg] = useState<{ text: string; cls: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (place.lat === undefined || place.lng === undefined) return null;
  const target = { lat: place.lat, lng: place.lng };

  const run = async () => {
    setBusy(true);
    const r = await locate();
    setBusy(false);
    if (!r.ok) { setMsg({ text: geoHelp(r.reason, isIOS()), cls: 'warn' }); return; }
    const now = appNow();
    const a = arrival(r.pos, target, now, at);
    const dist = formatDistance(walkingDistanceM(r.pos, target));
    const eta = romeParts(a.arriveAt).time;
    if (a.marginMin === null) setMsg({ text: `${dist} · ${a.minutes} min a pie · llegaríais a las ${eta}`, cls: 'ok' });
    else if (a.marginMin >= 0) setMsg({ text: `${dist} · ${a.minutes} min a pie · llegáis a las ${eta}, con ${a.marginMin} min de margen`, cls: a.marginMin < 10 ? 'warn' : 'ok' });
    else setMsg({ text: `${dist} · ${a.minutes} min a pie · llegaríais ${-a.marginMin} min tarde (a las ${eta}). Mejor taxi o metro.`, cls: 'bad' });
  };

  return (
    <div class="stack" style={{ gap: '0.3rem' }}>
      <button type="button" class="btn" onClick={() => void run()} disabled={busy}><Icon name="clock" /> {busy ? 'Buscando…' : '¿Llego a tiempo?'}</button>
      {msg && <p class={`small chip ${msg.cls}`} style={{ whiteSpace: 'normal', borderRadius: '10px', padding: '0.4rem 0.6rem' }}>{msg.text}</p>}
    </div>
  );
}
