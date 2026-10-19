import { placeById } from '@/data/places';
import type { Place } from '@/data/types';
import { Icon } from '@/components/Icon';
import { directionsUrl } from '@/lib/maps';
import { openStatus, type TimedStop } from '@/lib/schedule';

export function euros(cents: number): string {
  return `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function PlaceFacts({ place }: { place: Place }) {
  const bits: string[] = [];
  if (place.address) bits.push(place.address);
  if (place.pricePPCents) bits.push(`${euros(place.pricePPCents)} p. p.`);
  if (place.hoursText) bits.push(place.hoursText);
  return (
    <div class="stack" style={{ gap: '0.3rem' }}>
      {bits.length > 0 && <p class="small muted">{bits.join(' · ')}</p>}
      <div class="row">
        {place.cashOnly && <span class="chip warn">Solo efectivo</span>}
      </div>
    </div>
  );
}

export function PlaceActions({ place, compact = false }: { place: Place; compact?: boolean }) {
  return (
    <div class="stop-actions">
      <a class="btn" href={directionsUrl(place)} target="_blank" rel="noopener">
        <Icon name="walk" /> {compact ? 'Ir' : 'Cómo llegar'}
      </a>
      {place.phone && (
        <a class="btn" href={telHref(place.phone)}>
          <Icon name="phone" /> Llamar
        </a>
      )}
    </div>
  );
}

export function StopCard({ stop, now, current = false, showDate = false }: { stop: TimedStop; now: number; current?: boolean; showDate?: boolean }) {
  const place = stop.placeId ? placeById.get(stop.placeId) : undefined;
  const status = place && stop.at ? openStatus(place, stop.at) : 'unknown';
  const closed = status === 'closed-today';
  const passed = stop.at !== null && stop.at + 45 * 60_000 < now && !current;

  return (
    <article class={`card${current ? ' current' : ''}`} style={passed ? { opacity: 0.65 } : undefined}>
      <div class="stop">
        <div class="stop-time">
          {stop.start ? <>{stop.approx ? '~' : ''}{stop.start}</> : '—'}
          {showDate && <div class="small muted">{stop.date.slice(8)}/{stop.date.slice(5, 7)}</div>}
        </div>
        <div class="stop-body">
          <h3 class={closed ? 'strike' : undefined}>{stop.title}</h3>
          {closed && <span class="chip bad">Cerrado ese día · usa el plan B</span>}
          {stop.note && <p class="small">{stop.note}</p>}
          {stop.pending && <p class="small pending">⚠️ Pendiente de confirmar: {stop.pending}</p>}
          {place && <PlaceFacts place={place} />}
          {stop.planB && stop.planB.length > 0 && (
            <details class="planb">
              <summary>Plan B ({stop.planB.length})</summary>
              <ul>
                {stop.planB.map((b) => {
                  const p = placeById.get(b.placeId)!;
                  return (
                    <li key={b.placeId}>
                      <b>{p.name}</b> <span class="small muted">· {b.reason}</span>
                      <PlaceFacts place={p} />
                      <PlaceActions place={p} compact />
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
          {place && <PlaceActions place={place} />}
        </div>
      </div>
    </article>
  );
}
