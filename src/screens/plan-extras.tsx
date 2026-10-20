import { useState } from 'preact/hooks';
import { meetingPoints, meetingRule, rainPlans } from '@/data/alternatives';
import type { DayNum } from '@/data/types';
import { meetingKey, rainDays, setShared, useSharedState } from '@/lib/plan-state';
import { DinnerVote } from '@/screens/us-votes';
import { RainSuggestion } from '@/screens/today-extras';

// Botón «Llueve» (F06), punto de encuentro (F22) y votación de cena (F17) en cada día del plan.
export function PlanExtras({ day }: { day: DayNum }) {
  const state = useSharedState();
  const rain = rainDays(state).has(day);
  const hasRainPlan = rainPlans.some((p) => p.day === day);
  // Un punto de encuentro por día: cambiar el del sábado no toca el del domingo.
  const custom = state.get(meetingKey(day))?.value as string | undefined;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(custom ?? '');

  return (
    <section class="stack">
      <RainSuggestion day={day} active={rain} />
      {hasRainPlan && (
        <div class="spread card">
          <div>
            <b>{rain ? '☔ Plan de lluvia activado' : '¿Llueve?'}</b>
            <p class="small muted">{rain ? 'Se ve igual en los dos móviles.' : 'Cambia la tarde por sitios bajo techo.'}</p>
          </div>
          <button type="button" class={`btn${rain ? '' : ' primary'}`} onClick={() => void setShared(`rain:${day}`, !rain)}>{rain ? 'Deshacer' : 'Llueve'}</button>
        </div>
      )}
      <div class="card stack" style={{ gap: '0.4rem' }}>
        <div class="spread">
          <b>Punto de encuentro</b>
          <button type="button" class="btn ghost" onClick={() => setEditing(!editing)}>{editing ? 'Cerrar' : 'Cambiar'}</button>
        </div>
        <p>{custom || meetingPoints[day].place}</p>
        {custom && <p class="small muted">Del plan: {meetingPoints[day].place}</p>}
        {editing && (
          <div class="row">
            <input type="text" value={text} placeholder="Ej.: la fuente de la plaza" onInput={(e) => setText((e.target as HTMLInputElement).value)} aria-label="Nuevo punto de encuentro" style={{ flex: 1 }} />
            <button type="button" class="btn primary" onClick={() => { void setShared(meetingKey(day), text.trim() || null); setEditing(false); }}>Fijar</button>
          </div>
        )}
        <p class="small muted">{meetingRule}</p>
      </div>
      <DinnerVote day={day} />
    </section>
  );
}
