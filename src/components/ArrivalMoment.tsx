import { HeartBurst } from '@/components/HeartBurst';
import { Icon } from '@/components/Icon';
import { arrivalLine, type MapStop } from '@/lib/map-stops';

/** «Habéis llegado»: aparece sola al estar en una parada del día. Un momento para ellos, no para el móvil. */
export function ArrivalMoment({ stop, onDone, onClose }: { stop: MapStop; onDone: () => void; onClose: () => void }) {
  return (
    <section class="arrival" role="status" aria-live="polite" aria-label={`Habéis llegado a ${stop.title}`}>
      <HeartBurst />
      <p class="eyebrow">Habéis llegado · parada {stop.n}</p>
      <h2>{stop.title}</h2>
      <p class="arrival-line">{arrivalLine(stop.n)}</p>
      <div class="stop-actions">
        <a class="btn primary" href="/nosotros/fotos"><Icon name="camera" /> Foto de recuerdo</a>
        <a class="btn" href="/nosotros/diario"><Icon name="book" /> Escribirlo en el diario</a>
        <button type="button" class="btn" onClick={onDone}><Icon name="check" /> Hecho</button>
        <button type="button" class="btn ghost" onClick={onClose}>Ahora no</button>
      </div>
    </section>
  );
}
