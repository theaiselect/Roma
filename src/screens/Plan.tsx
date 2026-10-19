import { useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { Icon } from '@/components/Icon';
import { StopCard, type StopTicket } from '@/components/StopCard';
import { reservations } from '@/data/reservations';
import { days } from '@/data/trip';
import type { DayNum, ReservationStatus } from '@/data/types';
import { AlertList } from '@/screens/Today';
import { WeatherCard } from '@/screens/today-extras';
import { kmText, plannedKm } from '@/lib/plan-stats';
import { STATUS_LABEL } from '@/lib/reservations';
import { dayAlerts } from '@/lib/alerts';
import { useNow } from '@/lib/clock';
import { setCheck, useChecks } from '@/lib/checks';
import { nowState, type TimedStop } from '@/lib/schedule';
import { useTimeline } from '@/lib/plan-state';
import { romeParts, weekdayOf } from '@/lib/time';
import { legViews } from '@/lib/travel';
import { PlanExtras } from '@/screens/plan-extras';


function TravelMode({ day, now, tl }: { day: DayNum; now: number; tl: TimedStop[] }) {
  const checks = useChecks('legs');
  const legs = tl.filter((s) => s.day === day && s.leg);
  const done = new Set([...checks.values()].filter((c) => c.done).map((c) => c.itemId));
  const views = legViews(legs, done, now);
  return (
    <section class="card stack" aria-labelledby="travel-title">
      <div class="spread">
        <h2 id="travel-title">Modo día de viaje</h2>
        <span class="chip">{done.size}/{legs.length}</span>
      </div>
      <ol class="list">
        {views.map((v) => (
          <li key={v.stop.id} class="leg">
            <input type="checkbox" checked={v.done} aria-label={`Hecho: ${v.stop.title}`}
              onChange={(e) => void setCheck('legs', v.stop.id, (e.target as HTMLInputElement).checked)} />
            <div>
              <div class="spread">
                <b class={v.done ? 'strike' : undefined}>{v.stop.start ? `${v.stop.approx ? '~' : ''}${v.stop.start} · ` : ''}{v.stop.title}</b>
              </div>
              {v.stop.note && <p class="small muted">{v.stop.note}</p>}
              {v.stop.pending && <p class="small pending">⚠️ Pendiente de confirmar: {v.stop.pending}</p>}
              {v.level && v.marginMin !== null && (
                <p class={`small margin ${v.level}`}>
                  {v.marginMin >= 0 ? `Margen: ${v.marginMin} min` : `Vas ${-v.marginMin} min tarde`}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TICKET_CLS: Record<ReservationStatus, string> = { bought: 'ok', pending: 'warn', todo: 'warn', soldout: 'bad' };

function DayHeader({ day, done, total, isToday }: { day: DayNum; done: number; total: number; isToday: boolean }) {
  const prev = days.find((d) => d.day === day - 1);
  const next = days.find((d) => d.day === day + 1);
  const km = plannedKm(day);
  return (
    <section class="card stack" style={{ gap: '0.5rem' }} aria-label="Resumen del día">
      <div class="spread">
        <div class="row">
          {isToday && <span class="chip ok">Hoy</span>}
          <span class="small muted">{total} paradas{km > 0 ? ` · unos ${kmText(km)} a pie (estimado)` : ''}</span>
        </div>
        <span class="chip num" aria-label={`${done} de ${total} hechas`}>{done}/{total}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Paradas hechas"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      <div class="spread">
        {prev ? <a class="btn ghost" href={`/plan/${prev.day}`}><Icon name="back" /> {prev.roman}</a> : <span />}
        {next ? <a class="btn ghost" href={`/plan/${next.day}`}>{next.roman} <Icon name="chevron" /></a> : <span />}
      </div>
    </section>
  );
}

export function Plan() {
  const { params } = useRoute();
  const now = useNow(30_000);
  const tl = useTimeline();
  const resStatus = useChecks('reservations');
  const doneChecks = useChecks('stops');
  const today = days.find((d) => d.date === romeParts(now).date);
  const day = (Number(params.day) || today?.day || 1) as DayNum;
  const info = days.find((d) => d.day === day)!;
  const stops = tl.filter((s) => s.day === day);
  const visible = stops.filter((s) => !s.leg);
  const state = nowState(tl, now);
  const doneIds = new Set(visible.filter((s) => doneChecks.get(s.id)?.done).map((s) => s.id));

  const ticketOf = (ticketId?: string): StopTicket | undefined => {
    const r = ticketId ? reservations.find((x) => x.id === ticketId) : undefined;
    if (!r) return undefined;
    const st = (resStatus.get(r.id)?.value as ReservationStatus | undefined) ?? r.status;
    return { title: r.title.length > 28 ? `${r.title.slice(0, 26)}…` : r.title, label: STATUS_LABEL[st], cls: TICKET_CLS[st] };
  };

  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) { document.getElementById(id)?.scrollIntoView({ block: 'center' }); return; }
    // Sin ancla: si es el día de hoy, se baja a la parada en curso (o a la siguiente) una sola vez.
    if (today?.day === day) {
      const target = state.current ?? state.next;
      if (target) window.setTimeout(() => document.getElementById(target.id)?.scrollIntoView({ block: 'center' }), 60);
    }
  }, [day]);

  return (
    <div class="stack-lg">
      <nav class="daytabs" aria-label="Días">
        {days.map((d) => (
          <a key={d.day} href={`/plan/${d.day}`} aria-current={d.day === day ? 'page' : undefined}>
            <b>{d.roman}</b>
            <span>{d.label.split(' ')[0]!.slice(0, 3)} {d.date.slice(8)}</span>
          </a>
        ))}
      </nav>
      <div class="page-title"><h1>{info.label}</h1></div>
      <div class="frieze" aria-hidden="true" />
      <DayHeader day={day} done={doneIds.size} total={visible.length} isToday={today?.day === day} />
      <AlertList alerts={dayAlerts(day, weekdayOf(info.date))} />
      <WeatherCard date={info.date} />
      {(day === 1 || day === 5) && <TravelMode day={day} now={now} tl={tl} />}
      <PlanExtras day={day} />
      <section class="stack" aria-label="Paradas">
        {visible.map((s) => (
          <div id={s.id} key={s.id}>
            <StopCard stop={s} now={now} current={state.current?.id === s.id && state.phase === 'during'}
              done={doneIds.has(s.id)} onDone={(v) => void setCheck('stops', s.id, v)} ticket={ticketOf(s.ticketId)} />
          </div>
        ))}
      </section>
    </div>
  );
}
