import { useState } from 'preact/hooks';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days, travellers } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { DailyQuestionCard } from '@/screens/us-daily';
import { appNow } from '@/lib/clock';
import { useVote } from '@/lib/reveal';
import { romeParts } from '@/lib/time';

/** Cenas con plan B (F17): cada uno vota y se revela cuando votan los dos. */
function dinnersOf(day: DayNum) {
  return itinerary.filter((s) => s.day === day && s.planB?.length && /cena/i.test(s.title));
}

function Choices({ topic, options, title }: { topic: string; options: { id: string; label: string }[]; title: string }) {
  const { mine, theirs, other, revealed, vote } = useVote(topic);
  const label = (id: string | null | undefined) => options.find((o) => o.id === id)?.label ?? id ?? '';
  return (
    <section class="card stack" style={{ gap: '0.5rem' }}>
      <h3>{title}</h3>
      <div class="stack" style={{ gap: '0.4rem' }}>
        {options.map((o) => (
          <button type="button" key={o.id} class={`btn block${mine?.choice === o.id ? ' primary' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => void vote(o.id)}>
            {mine?.choice === o.id ? '✓ ' : ''}{o.label}
          </button>
        ))}
      </div>
      {mine && (revealed
        ? <p class="small"><b>{travellers[other].name}</b> eligió: <b>{label(theirs!.choice)}</b>{theirs!.choice === mine.choice ? ' ♥ ¡Coincidís!' : ''}</p>
        : <p class="small muted">{theirs ? `${travellers[other].name} ya ha votado.` : `Falta que vote ${travellers[other].name}.`}</p>)}
      {!mine && theirs && <p class="small muted">{travellers[other].name} ya ha votado: vota para ver qué eligió.</p>}
    </section>
  );
}

export function DinnerVote({ day }: { day: DayNum }) {
  const date = days.find((d) => d.day === day)!.date;
  const dinners = dinnersOf(day);
  if (!dinners.length) return null;
  return (
    <>
      {dinners.map((s) => (
        <Choices key={s.id} topic={`dinner-${date}`} title="¿Dónde cenamos?"
          options={[s.placeId!, ...s.planB!.map((b) => b.placeId)].map((id) => ({ id, label: placeById.get(id)!.name }))} />
      ))}
    </>
  );
}

/** Momento del día (F44): voto secreto al mejor momento; se revela cuando votan los dos o al día siguiente. */
export function MomentVote({ day }: { day: DayNum }) {
  const date = days.find((d) => d.day === day)!.date;
  const options = itinerary.filter((s) => s.day === day && !s.leg).map((s) => ({ id: s.id, label: s.title }));
  return <Choices topic={`moment-${date}`} title="El mejor momento del día" options={options} />;
}

export function Votes() {
  // Abre en el día del viaje en curso (o el primero si aún no ha empezado).
  const [day, setDay] = useState<DayNum>(() => days.find((d) => d.date === romeParts(appNow()).date)?.day ?? 1);
  return (
    <section class="stack">
      <div class="legend" role="group" aria-label="Día">
        {days.map((d) => <button type="button" key={d.day} aria-pressed={d.day === day} onClick={() => setDay(d.day)}>{d.roman}</button>)}
      </div>
      <DailyQuestionCard day={day} />
      <DinnerVote day={day} />
      <MomentVote day={day} />
    </section>
  );
}
