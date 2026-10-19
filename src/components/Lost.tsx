import { useRef, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { ShareLocation } from '@/components/ShareLocation';
import { hotel } from '@/data/trip';
import { placeById } from '@/data/places';
import { directionsUrl } from '@/lib/maps';
import { telHref } from '@/components/StopCard';

/** Botón «Estoy perdido» (F21): mantener pulsado 1 s. */
export function LostButton() {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const start = (e: Event) => {
    e.preventDefault();
    setHolding(true);
    timer.current = window.setTimeout(() => { setHolding(false); setOpen(true); navigator.vibrate?.(30); }, 1000);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
  };

  return (
    <>
      <button type="button" class={`lost-fab${holding ? ' holding' : ''}`} aria-label="Estoy perdido: mantén pulsado un segundo"
        onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        onContextMenu={(e) => e.preventDefault()}>
        <span class="ring" aria-hidden="true" />
        <Icon name="lost" />
      </button>
      {open && <LostSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function LostSheet({ onClose }: { onClose: () => void }) {
  const h = placeById.get(hotel.placeId)!;
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section class="sheet stack-lg" role="dialog" aria-modal="true" aria-labelledby="lost-title" onClick={(e) => e.stopPropagation()}>
        <div class="spread">
          <h2 id="lost-title">Estoy perdido</h2>
          <button type="button" class="btn ghost" onClick={onClose}>Cerrar</button>
        </div>
        <div class="card stack">
          <p class="eyebrow">Para el taxista</p>
          <p class="taxi-text" lang="it">{hotel.name}<br />{hotel.taxiText}</p>
          <p class="small muted" lang="it">Per favore, mi porti a questo indirizzo.</p>
        </div>
        <div class="stack">
          <a class="btn primary block" href={directionsUrl({ ...h, name: `${hotel.name}, ${hotel.address}` })} target="_blank" rel="noopener">
            <Icon name="walk" /> Ruta al hotel
          </a>
          {hotel.phone
            ? <a class="btn block" href={telHref(hotel.phone)}><Icon name="phone" /> Llamar al hotel</a>
            : <p class="pending small">⚠️ Pendiente de confirmar: teléfono del hotel (en la confirmación de la reserva).</p>}
          <ShareLocation label="Enviar mi ubicación a Lucía" />
          <a class="btn block" href="tel:112"><Icon name="sos" /> Emergencias · 112</a>
          <a class="btn ghost block" href="/mas/emergencias" onClick={onClose}>Más teléfonos y qué hacer</a>
        </div>
        <p class="small muted">{hotel.reception}. Metro más cercano: Barberini (Línea A).</p>
      </section>
    </div>
  );
}
