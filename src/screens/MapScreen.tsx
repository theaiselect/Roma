import { PlaceActions } from '@/components/StopCard';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days } from '@/data/trip';
import { useNow } from '@/lib/clock';
import { romeParts } from '@/lib/time';

// Fase 1: lista de paradas del día con «Cómo llegar» (F19). El mapa sin conexión llega en la fase 2.
export function MapScreen() {
  const now = useNow(60_000);
  const today = days.find((d) => d.date === romeParts(now).date) ?? days[0]!;
  const stops = itinerary.filter((s) => s.day === today.day && s.placeId);
  return (
    <div class="stack-lg">
      <div class="page-title"><h1>Mapa</h1><span class="muted">{today.roman} · {today.label}</span></div>
      <ul class="list">
        {stops.map((s) => {
          const p = placeById.get(s.placeId!)!;
          return (
            <li key={s.id} class="card stack" style={{ gap: '0.3rem' }}>
              <b>{s.start ? `${s.start} · ` : ''}{s.title}</b>
              {p.address && <span class="small muted">{p.address}</span>}
              <PlaceActions place={p} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
