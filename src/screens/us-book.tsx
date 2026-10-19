import { useState } from 'preact/hooks';
import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { euros } from '@/components/StopCard';
import { challenges } from '@/data/challenges';
import { itinerary } from '@/data/itinerary';
import { monuments } from '@/data/monuments';
import { placeById } from '@/data/places';
import { days, travellers, tripEnd } from '@/data/trip';
import type { ExpenseEntity } from '@/screens/Expenses';
import type { PhotoEntity } from '@/screens/us-photos';
import type { DiaryEntity } from '@/screens/us-diary';
import type { LetterEntity } from '@/screens/us-letters';
import type { SongEntity } from '@/screens/us-songs';
import type { CheckEntity } from '@/lib/checks';
import { buildBookHtml, type BookDay } from '@/lib/book';
import { appNow } from '@/lib/clock';
import { getBlob, useKind } from '@/lib/db';
import { voiceIds } from '@/lib/diary';
import { compressImage } from '@/lib/image';
import { balance } from '@/lib/money';
import { plannedKm } from '@/lib/plan-stats';
import type { VoteEntity } from '@/lib/reveal';
import { romeParts, romeToUtc } from '@/lib/time';

// Se mantiene aquí el nombre exportado para quien ya lo importaba.
export { plannedKm };

const MAX_PHOTOS_SCREEN = 9;
const MAX_PHOTOS_FILE = 12;

function useStats() {
  const expenses = useKind<ExpenseEntity>('expense') ?? [];
  const checks = useKind<CheckEntity>('check') ?? [];
  const photos = useKind<PhotoEntity>('photo') ?? [];
  const diary = useKind<DiaryEntity>('diary') ?? [];
  const seen = checks.filter((c) => c.listId === 'monuments' && c.done && !c.deleted).length;
  const gelatos = itinerary.filter((s) => s.placeId && placeById.get(s.placeId)?.kind === 'gelato').length;
  const retos = new Set(photos.map((p) => p.challengeId).filter(Boolean)).size;
  const voices = diary.reduce((n, e) => n + voiceIds(e).length, 0);
  return {
    km: plannedKm().toLocaleString('es-ES', { maximumFractionDigits: 0 }),
    seen, gelatos, retos, voices, photos: photos.length,
    spent: euros(balance(expenses).totalCents),
  };
}

function Summary({ finished }: { finished: boolean }) {
  const votes = useKind<VoteEntity>('vote') ?? [];
  const st = useStats();
  const moments = days.map((d) => {
    const vs = votes.filter((v) => v.topic === `moment-${d.date}` && v.choice && !v.locked);
    return { d, picks: vs.map((v) => ({ who: v.author, title: itinerary.find((s) => s.id === v.choice)?.title ?? v.choice })) };
  });
  return (
    <section class="card stack">
      <p class="eyebrow">{finished ? 'Resumen del viaje' : 'Resumen hasta ahora'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {[
          [`${st.km} km`, 'andados (estimados, según el plan)'],
          [`${st.seen}`, `monumentos de ${monuments.length}`],
          [`${st.gelatos}`, 'gelatos del plan'],
          [st.spent, 'gastado entre los dos'],
          [`${st.photos}`, st.photos === 1 ? 'foto' : 'fotos'],
          [`${st.retos} de ${challenges.length}`, 'retos de fotos'],
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

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error('No se pudo leer la foto'));
    r.readAsDataURL(blob);
  });
}

/** El libro de nuestro viaje (F48) y el resumen final (F49). */
export function Book() {
  const diary = useKind<DiaryEntity>('diary') ?? [];
  const photos = (useKind<PhotoEntity>('photo') ?? []).slice().sort((a, b) => a.takenAt - b.takenAt);
  const songs = useKind<SongEntity>('song') ?? [];
  const letters = (useKind<LetterEntity>('letter') ?? []).filter((l) => l.opened && l.text);
  const stats = useStats();
  const finished = appNow() >= romeToUtc(tripEnd, '00:00');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const exportFile = async () => {
    setBusy(true);
    setNote(null);
    let missing = 0;
    try {
      const bookDays: BookDay[] = [];
      for (const d of days) {
        const dayPhotos: BookDay['photos'] = [];
        for (const p of photos.filter((x) => romeParts(x.takenAt).date === d.date).slice(0, MAX_PHOTOS_FILE)) {
          const blob = await getBlob(p.blobId);
          if (!blob) { missing++; continue; }
          dayPhotos.push({ src: await toDataUrl(await compressImage(blob, 900, 0.72)), caption: p.caption });
        }
        bookDays.push({
          roman: d.roman, label: d.label,
          diary: diary.filter((e) => e.day === d.day && e.text?.trim()).map((e) => ({ who: travellers[e.author].name, text: e.text })),
          songs: songs.filter((s) => s.day === d.day).map((s) => ({ who: travellers[s.author].name, title: s.title, artist: s.artist })),
          photos: dayPhotos,
        });
      }
      const html = buildBookHtml({
        title: 'Roma', subtitle: 'Jesús y Lucía · 30 de octubre – 3 de noviembre de 2026',
        days: bookDays,
        letters: letters.map((l) => ({ from: travellers[l.author].name, where: l.unlockPlaceId ? placeById.get(l.unlockPlaceId)?.name : undefined, text: l.text! })),
        stats: [
          { value: `${stats.km} km`, label: 'andados (estimados)' }, { value: `${stats.seen}`, label: `monumentos de ${monuments.length}` },
          { value: `${stats.photos}`, label: 'fotos' }, { value: `${stats.retos} de ${challenges.length}`, label: 'retos de fotos' },
        ],
      });
      const file = new File([html], 'libro-roma.html', { type: 'text/html' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Nuestro viaje a Roma' }).catch(() => undefined);
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      setNote(missing ? `Hecho. ${missing} ${missing === 1 ? 'foto no estaba descargada' : 'fotos no estaban descargadas'} en este móvil y no se incluyeron (conéctate un momento y vuelve a probar).` : 'Hecho: el archivo se abre en cualquier móvil o PC, sin conexión.');
    } catch {
      setNote('No se ha podido crear el libro. Prueba otra vez; si falla, cierra y abre la app.');
    } finally { setBusy(false); }
  };

  return (
    <section class="stack-lg book">
      <Summary finished={finished} />
      <section class="card stack no-print">
        <h2>Llévatelo contigo</h2>
        <p class="small muted">Un archivo con el diario, las fotos, las canciones y las cartas abiertas. Se puede mandar por WhatsApp o guardar en Drive, y se abre en cualquier móvil o PC (desde ahí se imprime o se guarda como PDF).</p>
        <button type="button" class="btn primary" disabled={busy} onClick={() => void exportFile()}><Icon name="book" /> {busy ? 'Preparando el libro…' : 'Guardar el libro (archivo)'}</button>
        <button type="button" class="btn" onClick={() => window.print()}><Icon name="file" /> Imprimir o guardar como PDF</button>
        <p class="small muted">Si el botón de imprimir no hace nada (pasa en algunos iPhone), usa el archivo de arriba.</p>
        {note && <p class="small" role="status">{note}</p>}
      </section>
      <h2 class="print-only">Roma · 30 de octubre – 3 de noviembre de 2026</h2>
      {days.map((d) => {
        const dayPhotos = photos.filter((p) => romeParts(p.takenAt).date === d.date);
        const dsongs = songs.filter((s) => s.day === d.day);
        const entries = diary.filter((e) => e.day === d.day && e.text);
        const voices = diary.filter((e) => e.day === d.day).reduce((n, e) => n + voiceIds(e).length, 0);
        return (
          <article key={d.day} class="card stack" style={{ breakInside: 'avoid' }}>
            <h2>{d.roman} · {d.label}</h2>
            {entries.map((e) => (
              <div key={e.id}>
                <p class="eyebrow">{travellers[e.author].name}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p>
              </div>
            ))}
            {voices > 0 && <p class="small muted no-print">{voices === 1 ? '1 nota de voz (se escucha en el Diario)' : `${voices} notas de voz (se escuchan en el Diario)`}</p>}
            {dsongs.map((s) => <p key={s.id} class="small"><Icon name="music" size={16} /> {s.title}{s.artist ? ` · ${s.artist}` : ''} <span class="muted">({travellers[s.author].name})</span></p>)}
            {dayPhotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                {dayPhotos.slice(0, MAX_PHOTOS_SCREEN).map((p) => <BlobImage key={p.id} id={p.blobId} alt={p.caption || 'Foto'} style={{ aspectRatio: '1', objectFit: 'cover' }} />)}
              </div>
            )}
            {dayPhotos.length > MAX_PHOTOS_SCREEN && <p class="small muted no-print">+{dayPhotos.length - MAX_PHOTOS_SCREEN} fotos más en el archivo y en Fotos y retos.</p>}
            {!entries.length && !dayPhotos.length && !dsongs.length && <p class="small muted">Este día aún está en blanco.</p>}
          </article>
        );
      })}
      {letters.length > 0 && (
        <article class="card stack" style={{ breakInside: 'avoid' }}>
          <h2>Cartas</h2>
          {letters.map((l) => (
            <blockquote key={l.id} style={{ margin: 0, paddingLeft: '0.9rem', borderLeft: '3px solid var(--terracotta)' }}>
              <p class="eyebrow">De {travellers[l.author].name}{l.unlockPlaceId ? ` · ${placeById.get(l.unlockPlaceId)?.name ?? ''}` : ''}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{l.text}</p>
            </blockquote>
          ))}
        </article>
      )}
    </section>
  );
}
