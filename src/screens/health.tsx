import { Icon } from '@/components/Icon';
import { telHref } from '@/components/StopCard';
import { healthPlaces } from '@/data/health';
import { directionsUrl } from '@/lib/maps';

/** Hospitales y farmacias cerca del hotel y de la ruta (F33), con fuente. */
export function HealthPlaces() {
  return (
    <section class="stack">
      <h2>Salud</h2>
      {healthPlaces.map((h) => (
        <article key={h.id} class="card stack" style={{ gap: '0.4rem' }}>
          <h3>{h.name}</h3>
          {h.address && <p class="small muted">{h.address}</p>}
          <p class="small">{h.note}</p>
          <div class="row">
            {h.phone && <a class="btn" href={telHref(h.phone)}><Icon name="phone" /> <span class="num">{h.phone}</span></a>}
            {h.address && <a class="btn" href={directionsUrl({ name: h.name, address: h.address })} target="_blank" rel="noopener"><Icon name="walk" /> Cómo llegar</a>}
          </div>
          <a class="small" href={h.source} target="_blank" rel="noopener">Fuente</a>
        </article>
      ))}
    </section>
  );
}
