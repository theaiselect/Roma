import { useState } from 'preact/hooks';
import { HeartBurst } from '@/components/HeartBurst';
import { MetroNear, StarButton, WikiBlock } from '@/components/MapExtras';
import { Icon } from '@/components/Icon';
import { PlaceFacts, telHref } from '@/components/StopCard';
import { placeById } from '@/data/places';
import { reservations } from '@/data/reservations';
import { days } from '@/data/trip';
import type { ReservationStatus } from '@/data/types';
import type { MapStop } from '@/lib/map-stops';
import { setCheck, useChecks } from '@/lib/checks';
import { useKind } from '@/lib/db';
import { distanceM, formatDistance, type LatLng } from '@/lib/geo';
import { directionsUrl, isIOS } from '@/lib/maps';
import { STATUS_LABEL } from '@/lib/reservations';
import { formatDuration, openStatus } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { sunsetAt } from '@/lib/sun';
import { romeParts } from '@/lib/time';
import { isRainy, useForecast, weatherText } from '@/lib/weather';
import type { LetterEntity } from '@/screens/us-letters';

const TICKET_CLS: Record<ReservationStatus, string> = { bought: 'ok', pending: 'warn', todo: 'warn', soldout: 'bad' };

/** Cuándo es: «en 25 min», «hace 1 h»… solo si la parada es de hoy. */
export function whenText(at: number | null, now: number): string | null {
  if (at === null) return null;
  const diff = at - now;
  if (Math.abs(diff) > 12 * 3600_000) return null;
  if (Math.abs(diff) <= 30_000) return 'ahora';
  return diff > 0 ? `en ${formatDuration(diff)}` : `hace ${formatDuration(-diff)}`;
}

/** Ficha de una parada sobre el mapa: qué hacemos ahí, hora, entrada, horario, tiempo y cómo llegar. */
export function StopSheet({ stop, total, color, now, me, routing, onClose, onWalk, onGo }: {
  stop: MapStop; total: number; color: string; now: number; me: LatLng | null; routing: boolean;
  onClose: () => void; onWalk: () => void; onGo: (dir: -1 | 1) => void;
}) {
  const meWho = useSettings().profile ?? 'jesus';
  const forecast = useForecast();
  const resStatus = useChecks('reservations');
  const stopChecks = useChecks('stops');
  const [burst, setBurst] = useState(0);
  const done = stop.visits.every((v) => stopChecks.get(v.id)?.done);
  const toggleDone = () => { const v = !done; for (const x of stop.visits) void setCheck('stops', x.id, v); if (v) setBurst(Date.now()); };
  const letters = (useKind<LetterEntity>('letter') ?? []).filter((l) => !l.deleted && l.unlockPlaceId === stop.placeId && l.to === meWho && !l.opened);
  const place = placeById.get(stop.placeId);
  const first = stop.visits[0]!;
  const dayInfo = days.find((d) => d.day === first.day);
  const fc = forecast && !forecast.normals ? forecast.days.find((d) => d.date === first.date) : undefined;
  const status = place && first.at ? openStatus(place, first.at) : 'unknown';
  const rel = whenText(first.at, now);
  const dist = me ? distanceM(me, stop) * 1.3 : null;
  const rid = stop.visits.map((v) => v.ticketId).find(Boolean);
  const res = rid ? reservations.find((r) => r.id === rid) : undefined;
  const rst = res ? ((resStatus.get(res.id)?.value as ReservationStatus | undefined) ?? res.status) : undefined;
  const wd = dayInfo?.label.split(' ')[0];

  return (
    <section class="stopsheet" aria-label={`Parada ${stop.n}: ${stop.title}`}>
      {burst > 0 && <HeartBurst key={burst} />}
      <div class="stopsheet-head">
        <span class="stopnum" style={{ background: stop.status === 'done' ? '#A89F97' : color }} aria-hidden="true">{stop.n}</span>
        <div class="stopsheet-title">
          <h2>{stop.title}</h2>
          <p class="small muted num">
            {wd} {first.date.slice(8)}/{first.date.slice(5, 7)}{first.start ? ` · ${first.approx ? '~' : ''}${first.start}` : ''}
            {rel ? <b style={{ color }}> · {rel}</b> : null}
            {` · parada ${stop.n} de ${total}`}
          </p>
        </div>
        <button type="button" class="btn ghost" onClick={onClose} aria-label="Cerrar la ficha">✕</button>
      </div>

      <div class="row" style={{ flexWrap: 'wrap' }}>
        {status === 'closed-today' && <span class="chip bad">Cerrado ese día · mira el plan B</span>}
        {status === 'closed' && <span class="chip warn">Cerrado a esa hora</span>}
        {status === 'open' && <span class="chip ok">Abierto a esa hora</span>}
        {res && rst && <a class={`chip ${TICKET_CLS[rst]}`} href="/mas/reservas" style={{ textDecoration: 'none' }}><Icon name="ticket" size={14} /> {res.title}: {STATUS_LABEL[rst]}</a>}
      </div>

      <WikiBlock placeId={stop.placeId} />
      {first.note && <p class="small">{first.note}</p>}
      {first.pending && <p class="small pending">⚠️ Pendiente de confirmar: {first.pending}</p>}
      {stop.visits.length > 1 && <p class="small muted">Volvéis aquí más tarde: {stop.visits.slice(1).map((v) => `${v.start ?? ''} ${v.title}`.trim()).join(' · ')}.</p>}
      {place && <PlaceFacts place={place} />}

      {fc ? (
        <p class="small"><Icon name={isRainy(fc.code, fc.rainProb) ? 'rain' : 'sun'} size={16} /> {weatherText(fc.code)} · <span class="num">{fc.tmin}–{fc.tmax} °C</span>{fc.rainProb !== null ? <span class="muted num"> · lluvia {fc.rainProb} %</span> : null} · atardecer <b class="num">{romeParts(sunsetAt(first.date)).time}</b></p>
      ) : (
        <p class="small muted"><Icon name="sun" size={16} /> Atardecer a las <span class="num">{romeParts(sunsetAt(first.date)).time}</span></p>
      )}
      <MetroNear p={stop} />
      {dist !== null && <p class="small"><Icon name="walk" size={16} /> A <b class="num">{formatDistance(dist)}</b> de donde estás (unos <span class="num">{Math.max(1, Math.round(dist / 80))} min</span> a pie).</p>}

      {letters.length > 0 && <a class="chip" href="/nosotros/cartas" style={{ textDecoration: 'none', background: 'color-mix(in srgb, var(--rosa-romano) 30%, var(--tarjeta))' }}>♥ Hay una carta para ti que se abre en este sitio</a>}

      <div class="stop-actions">
        <button type="button" class="btn primary" disabled={routing} onClick={onWalk}><Icon name="walk" /> {routing ? 'Calculando…' : 'Ruta a pie'}</button>
        <a class="btn" href={directionsUrl({ name: place?.name ?? stop.title, address: place?.address, lat: stop.lat, lng: stop.lng })} target="_blank" rel="noopener"><Icon name="pin" /> {isIOS() ? 'Apple Maps' : 'Google Maps'}</a>
        <button type="button" class={`btn${done ? ' primary' : ''}`} aria-pressed={done} onClick={toggleDone}><Icon name="check" /> {done ? 'Hecho ♥' : 'Marcar como hecho'}</button>
        <StarButton p={{ name: place?.name ?? stop.title, lat: stop.lat, lng: stop.lng, placeId: stop.placeId }} />
        {place?.phone && <a class="btn" href={telHref(place.phone)}><Icon name="phone" /> Llamar</a>}
        <a class="btn ghost" href={`/plan/${first.day}#${first.id}`}>Ver en el plan</a>
      </div>
      <div class="row spread">
        <button type="button" class="btn" disabled={stop.n <= 1} onClick={() => onGo(-1)}><Icon name="back" /> Anterior</button>
        <span class="small muted num">{stop.n} / {total}</span>
        <button type="button" class="btn" disabled={stop.n >= total} onClick={() => onGo(1)}>Siguiente <Icon name="chevron" /></button>
      </div>
    </section>
  );
}
