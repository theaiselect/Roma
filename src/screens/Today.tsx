import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { StopCard } from '@/components/StopCard';
import { placeById } from '@/data/places';
import { days, luciaTrain, travellers, tripStart } from '@/data/trip';
import { dayAlerts, type Alert } from '@/lib/alerts';
import { useNow } from '@/lib/clock';
import { useSettings } from '@/lib/settings';
import { formatDuration, nowState, type TimedStop } from '@/lib/schedule';
import { useTimeline } from '@/lib/plan-state';
import { daysUntil, romeParts, romeToUtc, weekdayOf } from '@/lib/time';
import type { Who } from '@/data/types';
import { TodayExtras } from '@/screens/today-extras';


export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  return (
    <div class="stack" role="list" aria-label="Avisos">
      {alerts.map((a) => (
        <div key={a.id} role="listitem" class={`alert ${a.level === 'info' ? 'info' : a.level === 'danger' ? 'danger' : ''}`}>
          <Icon name={a.level === 'info' ? 'info' : 'alert'} />
          <span>{a.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Cuenta atrás del reencuentro (F10): frase distinta según quién mira. */
function Reunion({ tl, now, profile }: { tl: TimedStop[]; now: number; profile: Who | null }) {
  const meet = tl.find((s) => s.id === 'd1-lucia');
  if (!meet?.at || now >= meet.at || now < meet.at - 18 * 3600_000) return null;
  const left = formatDuration(meet.at - now);
  const luciaThere = now >= romeToUtc('2026-10-30', luciaTrain.arrivesTermini);
  const text = profile === 'jesus'
    ? (luciaThere ? `Lucía te espera en Roma. Os veis en ${left}.` : `Lucía y tú, en Roma en ${left}.`)
    : (luciaThere ? `Jesús llega en ${left}. Ya casi.` : `Jesús y tú, en Roma en ${left}.`);
  return <section class="card stack" style={{ background: 'color-mix(in srgb, var(--rosa-romano) 22%, var(--tarjeta))' }}><p class="eyebrow">El reencuentro</p><h2>{text}</h2></section>;
}

export function Today() {
  const now = useNow(15_000);
  const settings = useSettings();
  const tl = useTimeline();
  const parts = romeParts(now);
  const state = nowState(tl, now);
  const tripDay = days.find((d) => d.date === parts.date);
  // De madrugada (antes de las 05:00) seguimos en el día anterior del viaje.
  const prevDay = parts.h < 5 ? days.find((d) => d.day === (tripDay?.day ?? 6) - 1) : undefined;
  const activeDay = prevDay && state.phase === 'during' ? prevDay : tripDay;
  const left = daysUntil(now, tripStart);
  const firstDayAutoFlip = parts.date === tripStart;

  if (state.phase === 'before') {
    const other = settings.profile === 'jesus' ? travellers.lucia.name : travellers.jesus.name;
    return (
      <div class="stack-lg">
        {firstDayAutoFlip && <Logo hero autoFlip />}
        <section class="card hero-next">
          <p class="eyebrow">Roma · 30 oct – 3 nov</p>
          <p class="countdown num">{left > 0 ? `Faltan ${left} ${left === 1 ? 'día' : 'días'}` : 'Hoy empieza'}</p>
          <p>{left > 1 ? `${other} y tú, cada vez más cerca.` : left === 1 ? (settings.profile === 'jesus' ? 'Mañana a estas horas, camino de Roma.' : 'Mañana, Roma y Jesús.') : 'Hoy es el día.'}</p>
          {settings.profile === 'jesus' && <p class="small muted">Lucía llega a Termini el viernes a las {luciaTrain.arrivesTermini}.</p>}
        </section>
        <Reunion tl={tl} now={now} profile={settings.profile} />
        {state.next && (
          <section class="stack">
            <h2>Lo primero</h2>
            <StopCard stop={state.next} now={now} showDate />
          </section>
        )}
        <TodayExtras now={now} day={null} />
      </div>
    );
  }

  if (state.phase === 'after' || !state.next) {
    return (
      <div class="stack-lg">
        <section class="card hero-next">
          <p class="eyebrow">Arrivederci, Roma</p>
          <h1>El viaje ha terminado</h1>
          <p>Todo lo que guardasteis sigue aquí: diario, fotos, gastos y monumentos.</p>
        </section>
        <TodayExtras now={now} day={null} />
      </div>
    );
  }

  const next = state.next;
  const nextPlace = next.placeId ? placeById.get(next.placeId) : undefined;
  const alerts = activeDay ? dayAlerts(activeDay.day, weekdayOf(activeDay.date)) : [];

  return (
    <div class="stack-lg">
      {firstDayAutoFlip && <Logo hero autoFlip />}
      <div class="page-title">
        <h1>{activeDay ? `${activeDay.roman} · ${activeDay.label.split(' ')[0]}` : 'Hoy'}</h1>
        <span class="muted num">{parts.time}</span>
      </div>

      <Reunion tl={tl} now={now} profile={settings.profile} />

      <section class="card current hero-next" aria-live="polite">
        <p class="eyebrow">Lo siguiente · {next.start}</p>
        <h2>{next.title}</h2>
        <p class="countdown num">{formatDuration(state.msToNext ?? 0)}</p>
        {nextPlace?.address && <p class="small muted">{nextPlace.address}</p>}
        {next.note && <p class="small">{next.note}</p>}
        {next.pending && <p class="small pending">⚠️ Pendiente de confirmar: {next.pending}</p>}
        <div class="stop-actions">
          {nextPlace && <a class="btn primary" href={`/plan/${next.day}#${next.id}`}>Ver en el plan</a>}
          {(next.day === 1 || next.day === 5) && next.leg && <a class="btn" href={`/plan/${next.day}`}><Icon name="train" /> Modo día de viaje</a>}
        </div>
      </section>

      <AlertList alerts={alerts} />

      {state.then.length > 0 && (
        <section class="stack">
          <h2>Después</h2>
          {state.then.map((s) => <StopCard key={s.id} stop={s} now={now} />)}
        </section>
      )}

      <TodayExtras now={now} day={activeDay?.day ?? null} />
    </div>
  );
}
