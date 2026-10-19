import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { euros } from '@/components/StopCard';
import { itinerary } from '@/data/itinerary';
import { monuments } from '@/data/monuments';
import { placeById } from '@/data/places';
import { days, travellers, tripEnd } from '@/data/trip';
import type { DayNum } from '@/data/types';
import type { ExpenseEntity } from '@/screens/Expenses';
import type { PhotoEntity } from '@/screens/us-photos';
import type { DiaryEntity } from '@/screens/us-diary';
import type { SongEntity } from '@/screens/us-songs';
import type { CheckEntity } from '@/lib/checks';
import { appNow } from '@/lib/clock';
import { useKind } from '@/lib/db';
import { distanceM } from '@/lib/geo';
import { balance } from '@/lib/money';
import type { VoteEntity } from '@/lib/reveal';
import { romeParts, romeToUtc } from '@/lib/time';

/** Kilómetros del plan: tramos entre paradas consecutivas con coordenadas × 1,3 por calles. */
export function plannedKm(day?: DayNum): number {
  let m = 0;
  for (const d of days) {
    if (day && d.day !== day) continue;
    const pts = itinerary.filter((s) => s.day === d.day && !s.leg).map((s) => (s.placeId ? placeById.get(s.placeId) : undefined)).filter((p) => p?.lat !== undefined) as { lat: number; lng: number }[];
    for (let i = 1; i < pts.length; i++) m += distanceM(pts[i - 1]!, pts[i]!) * 1.3;
  }
  return m / 1000;
}

function Summary() {
  const expenses = useKind<ExpenseEntity>('expense') ?? [];
  const checks = useKind<CheckEntity>('check') ?? [];
  const votes = useKind<VoteEntity>('vote') ?? [];
  const seen = checks.filter((c) => c.listId === 'monuments' && c.done && !c.deleted).length;
  const gelatos = itinerary.filter((s) => s.placeId && placeById.get(s.placeId)?.kind === 'gelato').length;
  const b = balance(expenses);
  const moments = days.map((d) => {
    const vs = votes.filter((v) => v.topic === `moment-${d.date}` && v.choice && !v.locked);
    return { d, picks: vs.map((v) => ({ who: v.author, title: itinerary.find((s) => s.id === v.choice)?.title ?? v.choice })) };
  });
  return (
    <section class="card stack">
      <p class="eyebrow">Resumen del viaje</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {[
          [`${plannedKm().toLocaleString('es-ES', { maximumFractionDigits: 0 })} km`, 'andados (estimados, según el plan)'],
          [`${seen}`, `monumentos de ${monuments.length}`],
          [`${gelatos}`, 'gelatos del plan'],
          [euros(b.totalCents), 'gastado entre los dos'],
        ].map(([n, l]) => <div key={l}><p class="countdown num" style={{ fontSize: '2rem' }}>{n}</p><p class="small muted">{l}</p></div>)}
      </div>
      <h3>Momentos votados</h3>
      <ul class="list small">
        {moments.filter((m) => m.picks.length).map((m) => (
          <li key={m.d.day}><b>{m.d.roman}</b> · {m.picks.map((p) => `${travellers[p.who].name}: ${p.title}`).join(' · ')}</li>
        ))}
        {!moments.some((m) => m.picks.length) && <li class="muted">Aún no hay votos (Nosotros → Votos).</li>}
      </ul>
    </section>
  );
}

/** El libro de nuestro viaje (F48) y el resumen final (F49). */
export function Book() {
  const diary = useKind<DiaryEntity>('diary') ?? [];
  const photos = useKind<PhotoEntity>('photo') ?? [];
  const songs = useKind<SongEntity>('song') ?? [];
  const finished = appNow() >= romeToUtc(tripEnd, '00:00');

  return (
    <section class="stack-lg book">
      {finished ? <Summary /> : <p class="card small">El resumen final aparece a partir del 3 de noviembre. El libro se va llenando con el diario, las fotos y las canciones.</p>}
      <div class="row no-print">
        <button type="button" class="btn primary" onClick={() => window.print()}><Icon name="book" /> Guardar como PDF</button>
        <span class="small muted">En el menú de imprimir, elige «Guardar como PDF».</span>
      </div>
      <h2 class="print-only">Roma · 30 de octubre – 3 de noviembre de 2026</h2>
      {days.map((d) => {
        const dayPhotos = photos.filter((p) => romeParts(p.takenAt).date === d.date);
        const song = songs.find((s) => s.day === d.day);
        const entries = diary.filter((e) => e.day === d.day && e.text);
        return (
          <article key={d.day} class="card stack" style={{ breakInside: 'avoid' }}>
            <h2>{d.roman} · {d.label}</h2>
            {entries.map((e) => (
              <div key={e.id}>
                <p class="eyebrow">{travellers[e.author].name}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p>
              </div>
            ))}
            {song && <p class="small"><Icon name="music" size={16} /> {song.title} · {song.artist}</p>}
            {dayPhotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                {dayPhotos.slice(0, 9).map((p) => <BlobImage key={p.id} id={p.blobId} alt={p.caption || 'Foto'} style={{ aspectRatio: '1', objectFit: 'cover' }} />)}
              </div>
            )}
            {!entries.length && !dayPhotos.length && !song && <p class="small muted">Este día aún está en blanco.</p>}
          </article>
        );
      })}
    </section>
  );
}
