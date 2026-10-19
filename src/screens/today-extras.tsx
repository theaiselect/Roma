import { Icon } from '@/components/Icon';
import { meetingPoints, meetingRule } from '@/data/alternatives';
import { nightBefore } from '@/data/packing';
import { reservations } from '@/data/reservations';
import { days } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { openTicket, type TicketEntity } from '@/screens/Reservations';
import { setCheck, useChecks } from '@/lib/checks';
import { useKind } from '@/lib/db';
import { lastMetroWarning } from '@/lib/metro';
import { rainDays, setShared, useSharedState, useTimeline } from '@/lib/plan-state';
import { useSettings } from '@/lib/settings';
import { sunsetAt } from '@/lib/sun';
import { romeParts } from '@/lib/time';
import { ageText, isRainy, useForecast, weatherText } from '@/lib/weather';
import { DailyQuestionCard } from '@/screens/us-daily';

function WeatherCard({ date }: { date: string }) {
  const f = useForecast();
  const day = f?.days.find((d) => d.date === date);
  const sunset = romeParts(sunsetAt(date)).time;
  return (
    <section class="card stack" style={{ gap: '0.35rem' }} aria-label="Tiempo y atardecer">
      <div class="spread">
        <div class="row">
          <Icon name={day && isRainy(day.code, day.rainProb) ? 'rain' : 'sun'} />
          {day
            ? <b>{weatherText(day.code)} · <span class="num">{day.tmin}–{day.tmax} °C</span>{day.rainProb !== null ? <span class="muted num"> · lluvia {day.rainProb} %</span> : null}</b>
            : <span class="muted">Sin previsión para este día todavía</span>}
        </div>
      </div>
      <p class="small"><Icon name="sun" size={16} /> Atardecer a las <b class="num">{sunset}</b></p>
      {f && <p class="small muted">Previsión de Open-Meteo, {ageText(f.fetchedAt)}.</p>}
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
              ? files.map((t) => <button type="button" key={t.id} class="btn primary block" onClick={() => void openTicket(t)}><Icon name="ticket" /> Abrir {t.name}</button>)
              : <a class="btn block" href="/mas/reservas">Aún no hay archivo: añadirlo</a>}
          </div>
        );
      })}
    </section>
  );
}

function RainAndMeeting({ day }: { day: DayNum }) {
  const state = useSharedState();
  const rain = rainDays(state).has(day);
  const custom = state.get('meeting')?.value as string | undefined;
  return (
    <section class="card stack" style={{ gap: '0.5rem' }}>
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
      {sunsetSoon && <div class="alert info"><Icon name="sun" /><span>El atardecer es a las {romeParts(sunset!).time}: en {Math.round((sunset! - now) / 60_000)} min.</span></div>}
      {metro && <div class="alert"><Icon name="train" /><span>{metro} Si no, taxi o a pie.</span></div>}
      {info && <WeatherCard date={info.date} />}
      {day && <RainAndMeeting day={day} />}
      {showNight && tomorrow && <NightBefore forDay={tomorrow.day} />}
      {day && <DailyQuestionCard day={day} />}
    </>
  );
}
