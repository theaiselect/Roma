import { placeById } from '@/data/places';
import type { Place } from '@/data/types';
import { Icon } from '@/components/Icon';
import { ArrivalButton } from '@/components/Arrival';
import { PlaceCulture } from '@/components/Culture';
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
      {place.order?.length ? <p class="small">Pedir: {place.order.join(' · ')}</p> : null}
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

export interface StopTicket { title: string; label: string; cls: string }

export function StopCard({ stop, now, current = false, showDate = false, done, onDone, ticket }: {
  stop: TimedStop; now: number; current?: boolean; showDate?: boolean;
  /** Casilla «hecho» (solo en el Plan): se comparte entre los dos móviles. */
  done?: boolean; onDone?: (v: boolean) => void;
  /** Estado de la entrada o reserva de esta parada. */
  ticket?: StopTicket;
}) {
  const place = stop.placeId ? placeById.get(stop.placeId) : undefined;
  const status = place && stop.at ? openStatus(place, stop.at) : 'unknown';
  const closed = status === 'closed-today';
  const passed = (stop.at !== null && stop.at + 45 * 60_000 < now && !current) || done === true;

  return (
    <article class={`card${current ? ' current' : ''}`} style={passed ? { opacity: 0.65 } : undefined}>
      <div class="stop">
        <div class="stop-time">
          {stop.start ? <>{stop.approx ? '~' : ''}{stop.start}</> : '—'}
          {showDate && <div class="small muted">{stop.date.slice(8)}/{stop.date.slice(5, 7)}</div>}
          {onDone && (
            <input type="checkbox" class="stopcheck" checked={done === true} aria-label={`Hecho: ${stop.title}`}
              onChange={(e) => onDone((e.target as HTMLInputElement).checked)} />
          )}
        </div>
        <div class="stop-body">
          <h3 class={closed || done ? 'strike' : undefined}>{stop.title}</h3>
          {closed && <span class="chip bad">Cerrado ese día · usa el plan B</span>}
          {ticket && <a class={`chip ${ticket.cls}`} href="/mas/reservas" style={{ justifySelf: 'start', textDecoration: 'none' }}><Icon name="ticket" size={14} /> {ticket.title}: {ticket.label}</a>}
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
          {place && <PlaceCulture placeId={place.id} />}
          {place && stop.at !== null && stop.at > now && stop.at - now < 12 * 3600_000 && <ArrivalButton place={place} at={stop.at} />}
        </div>
      </div>
    </article>
  );
}
