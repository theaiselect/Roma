import { useState } from 'preact/hooks';
import { questionId, questions } from '@/data/questions';
import { days, travellers } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { useAnswer } from '@/lib/reveal';

/** Pregunta del día (F43): respuestas ocultas hasta que respondan los dos. */
export function DailyQuestionCard({ day }: { day: DayNum }) {
  const date = days.find((d) => d.day === day)!.date;
  const { mine, theirs, other, revealed, answer } = useAnswer(questionId(date));
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  return (
    <section class="card stack" aria-labelledby={`q-${day}`}>
      <p class="eyebrow">Pregunta del día</p>
      <h2 id={`q-${day}`}>{questions[day]}</h2>
      {!mine || editing ? (
        <div class="stack" style={{ gap: '0.5rem' }}>
          <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Tu respuesta…" aria-label="Tu respuesta" />
          <button type="button" class="btn primary" disabled={!text.trim()} onClick={() => { void answer(text.trim()); setEditing(false); }}>Responder</button>
        </div>
      ) : (
        <div class="stack" style={{ gap: '0.4rem' }}>
          <p><b>Tú:</b> {mine.text}</p>
          {revealed
            ? <p><b>{travellers[other].name}:</b> {theirs!.text}</p>
            : <p class="small muted">{theirs ? `${travellers[other].name} ya ha respondido: se ve en cuanto se sincronice.` : `Esperando a ${travellers[other].name}…`}</p>}
          {!revealed && <button type="button" class="btn ghost" onClick={() => { setText(mine.text ?? ''); setEditing(true); }}>Cambiar mi respuesta</button>}
        </div>
      )}
      {!mine && theirs && <p class="small muted">{travellers[other].name} ya ha respondido. Responde para verlo.</p>}
    </section>
  );
}
