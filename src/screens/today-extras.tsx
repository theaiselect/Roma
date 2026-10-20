import { Icon } from '@/components/Icon';
import { meetingPoints, meetingRule } from '@/data/alternatives';
import { nightBefore } from '@/data/packing';
import { places } from '@/data/places';
import { reservations } from '@/data/reservations';
import { days, tripEnd, tripStart } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { openTicket, type TicketEntity } from '@/screens/Reservations';
import { setCheck, useChecks } from '@/lib/checks';
import { useKind, type Entity } from '@/lib/db';
import { lastMetroWarning } from '@/lib/metro';
import { rainDays, setShared, useSharedState, useTimeline } from '@/lib/plan-state';
import { useLocal } from '@/lib/local';
import { backupReminder } from '@/lib/backup-reminder';
import { useChecks as useReservationStatus } from '@/lib/checks';
import { openReservations, untilText } from '@/lib/reservations';
import type { ReservationStatus } from '@/data/types';
import { rainPlans } from '@/data/alternatives';
import { useSettings } from '@/lib/settings';
import { opensOn } from '@/lib/schedule';
import { sunsetAt } from '@/lib/sun';
import { daysUntil, romeParts, romeToUtc } from '@/lib/time';
import { ageText, climateNormals, isRainy, rainSuggested, useForecast, weatherText } from '@/lib/weather';
import { DailyQuestionCard } from '@/screens/us-daily';

export function WeatherCard({ date }: { date: string }) {
  const f = useForecast();
  const day = f?.days.find((d) => d.date === date) ?? (f ? undefined : climateNormals([date]).days[0]);
  const sunset = romeParts(sunsetAt(date)).time;
  return (
    <section class="stack" style={{ gap: '0.5rem' }} aria-label="Tiempo y atardecer">
      <div class="tiles">
        <div class="tile">
          <Icon name={day && isRainy(day.code, day.rainProb) ? 'rain' : 'sun'} size={22} />
          {day
            ? <div class="tile-text"><b class="num">{day.tmin}–{day.tmax} °C</b><span>{weatherText(day.code)}{day.rainProb !== null ? ` · lluvia ${day.rainProb} %` : ''}</span></div>
            : <div class="tile-text"><b>Sin previsión</b><span>para este día todavía</span></div>}
        </div>
        <div class="tile tile-sunset">
          <Icon name="sun" size={22} />
          <div class="tile-text"><b class="num">{sunset}</b><span>Atardecer a las {sunset}</span></div>
        </div>
      </div>
      {f ? <p class="small muted">Previsión de Open-Meteo, {ageText(f.fetchedAt)}.</p> : <p class="small muted">Sin previsión guardada: es lo típico de Roma en estas fechas.</p>}
    </section>
  );
}

/** Sitios para comer que hoy cierran (según los horarios guardados), para no ir en balde. */
export function closedToday(now: number): string[] {
  const wd = romeParts(now).weekday;
  return places.filter((pl) => pl.kind === 'food' && opensOn(pl, wd) === false).map((pl) => pl.name);
}

function ClosedToday({ now }: { now: number }) {
  const names = closedToday(now);
  if (!names.length) return null;
  return (
    <section class="card stack" style={{ gap: '0.35rem' }} aria-label="Sitios cerrados hoy">
      <b>Hoy cierran</b>
      <p class="small">{names.join(' · ')}</p>
      <p class="small muted">Según los horarios guardados; si vais a otro sitio, mirad antes que abre.</p>
    </section>
  );
}

function NightBefore({ forDay }: { forDay: DayNum }) {
  const me = useSettings().profile ?? 'jesus';
  const checks = useChecks('nightBefore');
  const items = nightBefore.filter((i) => !i.forDay || i.forDay === forDay);
  const done = items.filter((i) => checks.get(`${forDay}-${i.id}:${me}`)?.done).length;
  return (
    <section class="card stack" aria-labelledby="nb-title">
      <div class="spread"><h2 id="nb-title">Antes de dormir</h2><span class="chip">{done}/{items.length}</span></div>
      <ul class="list">
        {items.map((i) => {
          const key = `${forDay}-${i.id}`;
          const on = checks.get(`${key}:${me}`)?.done ?? false;
          return (
            <li key={i.id} class="leg">
              <input type="checkbox" id={`nb-${i.id}`} checked={on} onChange={(e) => void setCheck('nightBefore', key, (e.target as HTMLInputElement).checked, { who: me })} />
              <label for={`nb-${i.id}`} class={on ? 'strike' : undefined}>{i.text}</label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TicketsSoon({ now }: { now: number }) {
  const tl = useTimeline();
  const tickets = useKind<TicketEntity>('ticket') ?? [];
  // Entrada a mano 30 min antes (F12) y hasta 45 min después de la hora.
  const soon = tl.filter((s) => s.ticketId && s.at !== null && now >= s.at - 30 * 60_000 && now <= s.at + 45 * 60_000);
  const ids = [...new Set(soon.map((s) => s.ticketId!))];
  if (!ids.length) return null;
  return (
    <section class="card current stack" aria-label="Entradas para ahora">
      <h2>Ten la entrada a mano</h2>
      <p class="small">Sube el brillo de la pantalla al máximo para que lean el QR.</p>
      {ids.map((rid) => {
        const r = reservations.find((x) => x.id === rid);
        const files = tickets.filter((t) => t.reservationId === rid);
        return (
          <div key={rid} class="stack" style={{ gap: '0.4rem' }}>
            <b>{r?.title}</b>
            {files.length
              ? files.map((t) => <button type="button" key={t.id} class="btn primary block" onClick={() => void openTicket(t, files)}><Icon name="ticket" /> Abrir {t.name}</button>)
              : <a class="btn block" href="/mas/reservas">Aún no hay archivo: añadirlo</a>}
          </div>
        );
      })}
    </section>
  );
}

/** Si la previsión del día es de lluvia y hay plan bajo techo, se propone activarlo (un toque, vale para los dos móviles). */
export function RainSuggestion({ day, active }: { day: DayNum; active: boolean }) {
  const f = useForecast();
  const date = days.find((d) => d.day === day)?.date;
  const fc = f && !f.normals ? f.days.find((d) => d.date === date) : undefined;
  if (!rainSuggested(fc, rainPlans.some((p) => p.day === day), active)) return null;
  return (
    <div class="alert info" role="status" style={{ alignItems: 'center' }}>
      <Icon name="rain" />
      <span style={{ flex: 1 }}>La previsión da lluvia{fc?.rainProb != null ? ` (${fc.rainProb} %)` : ''} para este día. ¿Cambiamos la tarde por sitios bajo techo?</span>
      <button type="button" class="btn primary" onClick={() => void setShared(`rain:${day}`, true)}>Activar plan de lluvia</button>
    </div>
  );
}

function RainAndMeeting({ day }: { day: DayNum }) {
  const state = useSharedState();
  const rain = rainDays(state).has(day);
  const custom = state.get('meeting')?.value as string | undefined;
  return (
    <section class="card stack" style={{ gap: '0.5rem' }}>
      <RainSuggestion day={day} active={rain} />
      <div class="spread">
        <div><b>{rain ? '☔ Plan de lluvia activado' : '¿Llueve?'}</b><p class="small muted">{rain ? 'La tarde cambia a sitios bajo techo en los dos móviles.' : 'Cambia la tarde por sitios bajo techo.'}</p></div>
        <button type="button" class={`btn${rain ? '' : ' primary'}`} onClick={() => void setShared(`rain:${day}`, !rain)}>{rain ? 'Deshacer' : 'Llueve'}</button>
      </div>
      <div class="frieze" aria-hidden="true" />
      <p class="small"><b>Punto de encuentro:</b> {custom || meetingPoints[day].place}</p>
      <p class="small muted">{meetingRule}</p>
    </section>
  );
}

/** Reservas que aún hay que hacer, lo más urgente primero. Desaparece cuando todo está hecho. */
export function OpenReservationsCard({ now }: { now: number }) {
  const status = useReservationStatus('reservations');
  const list = openReservations(reservations, (r) => (status.get(r.id)?.value as ReservationStatus | undefined) ?? r.status, now, daysUntil);
  if (!list.length) return null;
  const shown = list.slice(0, 4);
  return (
    <section class="card stack" style={{ gap: '0.4rem' }} aria-label="Reservas por hacer">
      <div class="spread"><b>{list.length === 1 ? 'Queda 1 reserva por hacer' : `Quedan ${list.length} reservas por hacer`}</b><a class="small" href="/mas/reservas">Ver todas</a></div>
      <ul class="list small">
        {shown.map(({ r, left }) => (
          <li key={r.id} class="spread">
            <a href="/mas/reservas">{r.title}</a>
            {left !== null && <span class={`chip num ${left <= 3 ? 'warn' : ''}`}>{untilText(left)}</span>}
          </li>
        ))}
      </ul>
      {list.length > shown.length && <p class="small muted">y {list.length - shown.length} más…</p>}
    </section>
  );
}

/** Recordatorio de copia de seguridad: solo si hay datos y hace días que no se guarda ninguna. */
export function BackupReminderCard({ now }: { now: number }) {
  const diary = useKind<Entity>('diary') ?? [];
  const photos = useKind<Entity>('photo') ?? [];
  const expenses = useKind<Entity>('expense') ?? [];
  const [lastAt] = useLocal<number | null>('roma-last-backup', null);
  const items = [...diary, ...photos, ...expenses].filter((e) => !e.deleted).length;
  const r = backupReminder({ now, lastAt, items, returnAt: romeToUtc(tripEnd, '00:00'), tripStartAt: romeToUtc(tripStart, '00:00') });
  if (!r) return null;
  return (
    <section class={`alert ${r.urgent ? '' : 'info'}`} role="status" style={{ alignItems: 'center' }}>
      <Icon name="backup" />
      <span style={{ flex: 1 }}>{r.text}</span>
      <a class="btn primary" href="/mas/ajustes#copia">Guardar copia</a>
    </section>
  );
}

/** Previsión de los días del viaje (Open-Meteo da 16 días: desde unos 2 semanas antes ya se ve el viaje entero). */
export function TripForecast() {
  const f = useForecast();
  const rows = days.map((d) => ({ d, fc: f && !f.normals ? f.days.find((x) => x.date === d.date) : undefined }));
  if (!rows.some((r) => r.fc)) return null;
  return (
    <section class="card stack" style={{ gap: '0.5rem' }} aria-label="Previsión del viaje">
      <b>El tiempo en el viaje</b>
      <div class="scroll-row" style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto' }}>
        {rows.map(({ d, fc }) => (
          <a key={d.day} href={`/plan/${d.day}`} class="card stack" style={{ gap: '0.15rem', minWidth: '5.2rem', padding: '0.6rem', textDecoration: 'none', textAlign: 'center' }}>
            <span class="eyebrow">{d.label.slice(0, 3)} {d.date.slice(8)}</span>
            {fc ? (<>
              <span style={{ justifySelf: 'center' }}><Icon name={isRainy(fc.code, fc.rainProb) ? 'rain' : 'sun'} /></span>
              <b class="num">{fc.tmin}–{fc.tmax}°</b>
              <span class="small muted">{fc.rainProb !== null ? `lluvia ${fc.rainProb} %` : weatherText(fc.code)}</span>
            </>) : <span class="small muted">sin datos aún</span>}
          </a>
        ))}
      </div>
      {f && <p class="small muted">Previsión de Open-Meteo, {ageText(f.fetchedAt)}. Cambia hasta el último día.</p>}
    </section>
  );
}

// Bloques extra de «Hoy»: tiempo, atardecer, entradas, último metro, lluvia, encuentro, noche anterior y pregunta del día.
export function TodayExtras({ now, day }: { now: number; day: DayNum | null }) {
  const p = romeParts(now);
  const metro = lastMetroWarning(now);
  const info = day ? days.find((d) => d.day === day) : undefined;
  const sunset = info ? sunsetAt(info.date) : null;
  const sunsetSoon = sunset !== null && sunset - now > 0 && sunset - now <= 45 * 60_000;
  // Lista de la noche anterior a partir de las 21:00 del día de antes.
  const tomorrow = days.find((d) => d.day === ((day ?? 0) + 1)) ?? (p.date === '2026-10-29' ? days[0] : undefined);
  const showNight = tomorrow && p.h >= 21 && (day !== null || p.date === '2026-10-29');

  return (
    <>
      <TicketsSoon now={now} />
      <BackupReminderCard now={now} />
      <OpenReservationsCard now={now} />
      {sunsetSoon && <div class="alert info"><Icon name="sun" /><span>El atardecer es a las {romeParts(sunset!).time}: en {Math.round((sunset! - now) / 60_000)} min.</span></div>}
      {metro && <div class="alert"><Icon name="train" /><span>{metro} Si no, taxi o a pie.</span></div>}
      {info && <WeatherCard date={info.date} />}
      {day && <ClosedToday now={now} />}
      {day && <RainAndMeeting day={day} />}
      {showNight && tomorrow && <NightBefore forDay={tomorrow.day} />}
      {day && <DailyQuestionCard day={day} />}
    </>
  );
}
