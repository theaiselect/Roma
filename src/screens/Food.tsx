import { PlaceActions, PlaceFacts } from '@/components/StopCard';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days } from '@/data/trip';
import type { DayNum, Place } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { useState } from 'preact/hooks';
import { useNow } from '@/lib/clock';
import { openStatus } from '@/lib/schedule';
import { romeParts, romeToUtc } from '@/lib/time';

const FOOD = new Set(['food', 'cafe', 'gelato', 'bar']);

function byDay(): { day: DayNum; items: { place: Place; time?: string; planB: boolean }[] }[] {
  return days.map((d) => {
    const items: { place: Place; time?: string; planB: boolean }[] = [];
    for (const s of itinerary.filter((x) => x.day === d.day)) {
      const p = s.placeId ? placeById.get(s.placeId) : undefined;
      if (p && FOOD.has(p.kind)) items.push({ place: p, time: s.start, planB: false });
      for (const b of s.planB ?? []) {
        const pb = placeById.get(b.placeId)!;
        if (FOOD.has(pb.kind) && !items.some((i) => i.place.id === pb.id)) items.push({ place: pb, time: s.start, planB: true });
      }
    }
    return { day: d.day, items };
  });
}

const STATUS_TEXT = { open: 'Abierto ahora', closed: 'Cerrado ahora', 'closed-today': 'Cerrado hoy', unknown: '' } as const;

/** Comidas (F13): todos los sitios del itinerario; los cerrados ese día salen tachados. */
export function Food() {
  const now = useNow(60_000);
  const today = romeParts(now).date;
  const [only, setOnly] = useState<DayNum | 0>(() => days.find((d) => d.date === today)?.day ?? 0);
  return (
    <div class="stack-lg">
      <BackTitle title="Comidas" />
      <p class="small muted">Precios por persona según el plan. Los que cierran el día que toca salen tachados.</p>
      <div class="legend" role="group" aria-label="Día">
        <button type="button" aria-pressed={only === 0} onClick={() => setOnly(0)}>Todos</button>
        {days.map((d) => <button type="button" key={d.day} aria-pressed={only === d.day} onClick={() => setOnly(d.day)}>{d.roman}</button>)}
      </div>
      {byDay().map(({ day, items }) => {
        const info = days.find((d) => d.day === day)!;
        if (!items.length || (only && only !== day)) return null;
        return (
          <section key={day} class="stack">
            <h2>{info.roman} · {info.label}</h2>
            {items.map(({ place, time, planB }) => {
              // Estado a la hora planeada; si es hoy, el estado real de ahora.
              const at = info.date === today ? now : romeToUtc(info.date, time ?? '13:00');
              const st = openStatus(place, at);
              const closed = st === 'closed-today';
              return (
                <article key={`${day}-${place.id}`} class="card stack" style={{ gap: '0.4rem' }}>
                  <div class="spread">
                    <h3 class={closed ? 'strike' : undefined}>{time && <span class="num">{time} · </span>}{place.name}</h3>
                    {planB && <span class="chip">Plan B</span>}
                  </div>
                  <div class="row">
                    {st !== 'unknown' && <span class={`chip ${st === 'open' ? 'ok' : 'bad'}`}>{info.date === today ? STATUS_TEXT[st] : closed ? 'Cerrado ese día' : st === 'open' ? 'Abierto a esa hora' : 'Cerrado a esa hora'}</span>}
                    {place.note && <span class="small muted">{place.note}</span>}
                  </div>
                  <PlaceFacts place={place} />
                  <PlaceActions place={place} />
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
