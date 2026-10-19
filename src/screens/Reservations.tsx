import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { shareTicketFile } from '@/components/TicketViewer';
import { telHref } from '@/components/StopCard';
import { reservations } from '@/data/reservations';
import { days } from '@/data/trip';
import type { Reservation, ReservationStatus } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { setCheck, useChecks } from '@/lib/checks';
import { useNow } from '@/lib/clock';
import { getBlob, putBlob, remove, save, useKind, type Entity } from '@/lib/db';
import { countReservations, reservationDate, sortReservations, STATUS_LABEL, untilText } from '@/lib/reservations';
import { ensureBlob } from '@/lib/sync';
import { showTicket } from '@/lib/ticket-view';
import { daysUntil } from '@/lib/time';

export interface TicketEntity extends Entity {
  kind: 'ticket';
  reservationId: string;
  blobId: string;
  mime: string;
  name: string;
}

const CLS: Record<ReservationStatus, string> = { bought: 'ok', pending: 'warn', todo: 'warn', soldout: 'bad' };

/** Enseña la entrada a pantalla completa dentro de la app (si hay varias del mismo sitio, se puede pasar de una a otra). */
export async function openTicket(t: TicketEntity, all: TicketEntity[] = [t]): Promise<void> {
  const list = all.some((x) => x.id === t.id) ? all : [t];
  showTicket(list, list.findIndex((x) => x.id === t.id));
}

export async function shareTicket(t: TicketEntity): Promise<void> {
  await ensureBlob(t.blobId).catch(() => false);
  const blob = await getBlob(t.blobId);
  if (!blob) { void openTicket(t); return; }
  await shareTicketFile(blob, t);
}

export function TicketList({ reservationId }: { reservationId: string }) {
  const tickets = (useKind<TicketEntity>('ticket') ?? []).filter((t) => t.reservationId === reservationId);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const blobId = await putBlob(f);
        await save({ kind: 'ticket', reservationId, blobId, mime: f.type || 'application/octet-stream', name: f.name });
      }
    } finally { setBusy(false); }
  };
  return (
    <div class="stack" style={{ gap: '0.4rem' }}>
      {tickets.map((t) => (
        <div key={t.id} class="row">
          <button type="button" class="btn" onClick={() => void openTicket(t, tickets)}><Icon name="file" /> {t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name}</button>
          <button type="button" class="btn" aria-label={`Compartir ${t.name}`} onClick={() => void shareTicket(t)}><Icon name="share" /></button>
          <button type="button" class="btn ghost" aria-label={`Quitar ${t.name}`} onClick={() => { if (confirm('¿Quitar este archivo de los dos móviles?')) void remove(t.id); }}><Icon name="trash" /></button>
        </div>
      ))}
      <label class="btn ghost" style={{ justifyContent: 'flex-start' }}>
        <Icon name="plus" /> {busy ? 'Guardando…' : 'Añadir QR o PDF'}
        <input type="file" accept="image/*,application/pdf" multiple class="sr-only" onChange={(e) => { const el = e.target as HTMLInputElement; void add(el.files).then(() => { el.value = ''; }); }} />
      </label>
    </div>
  );
}

/** Localizador o nota propia de la reserva; se guarda al salir del campo y se ve en los dos móviles. */
function OwnNote({ id, saved }: { id: string; saved: string }) {
  const [text, setText] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const commit = () => { if (dirty) { void setCheck('resnotes', id, true, { value: text.trim() }); setDirty(false); } };
  return (
    <label class="field small">
      Localizador o nota (se ve en los dos móviles)
      <input type="text" value={dirty ? text : saved} placeholder="Ej.: reserva a nombre de Jesús, código 123…" aria-label={`Localizador o nota de la reserva ${id}`}
        onInput={(e) => { setText((e.target as HTMLInputElement).value); setDirty(true); }} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

function ReservationCard({ r, st, note, now }: { r: Reservation; st: ReservationStatus; note: string; now: number }) {
  const day = r.day ? days.find((d) => d.day === r.day) : undefined;
  const date = reservationDate(r);
  const left = date ? daysUntil(now, date) : null;
  return (
    <article class="card stack">
      <div class="spread">
        <h3>{r.title}</h3>
        <span class={`chip ${CLS[st]}`}>{STATUS_LABEL[st]}</span>
      </div>
      {(day || r.time) && (
        <p class="small num">
          {day ? <a href={`/plan/${day.day}`}>{day.roman} · {day.label}</a> : null}{r.time ? ` · ${r.time}` : ''}
          {left !== null && st !== 'bought' && st !== 'soldout' && <span class={`chip ${left <= 3 ? 'warn' : ''}`} style={{ marginLeft: '0.5rem' }}>{untilText(left)}</span>}
        </p>
      )}
      {r.note && <p class="small">{r.note}</p>}
      <div class="row">
        {r.url && <a class="btn" href={r.url} target="_blank" rel="noopener"><Icon name="link" /> Web oficial</a>}
        {r.phone && <a class="btn" href={telHref(r.phone)}><Icon name="phone" /> {r.phone}</a>}
        {st !== 'bought' && st !== 'soldout' && (
          <button type="button" class="btn primary" onClick={() => void setCheck('reservations', r.id, true, { value: 'bought' })}><Icon name="check" /> Ya está hecho</button>
        )}
      </div>
      <label class="field small">
        Estado
        <select value={st} onChange={(e) => void setCheck('reservations', r.id, true, { value: (e.target as HTMLSelectElement).value })}>
          {(Object.keys(STATUS_LABEL) as ReservationStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
        </select>
      </label>
      <OwnNote id={r.id} saved={note} />
      <TicketList reservationId={r.id} />
    </article>
  );
}

export function Reservations() {
  const status = useChecks('reservations');
  const notes = useChecks('resnotes');
  const now = useNow(60_000);
  const statusOf = (r: Reservation) => (status.get(r.id)?.value as ReservationStatus | undefined) ?? r.status;
  const sorted = sortReservations(reservations, statusOf);
  const c = countReservations(reservations, statusOf);
  const groups: { title: string; items: Reservation[] }[] = [
    { title: 'Por hacer', items: sorted.filter((r) => ['todo', 'pending'].includes(statusOf(r))) },
    { title: 'Agotadas', items: sorted.filter((r) => statusOf(r) === 'soldout') },
    { title: 'Hechas', items: sorted.filter((r) => statusOf(r) === 'bought') },
  ];
  return (
    <div class="stack-lg">
      <BackTitle title="Reservas y entradas" />
      <section class="card stack" style={{ gap: '0.4rem' }} aria-label="Resumen de reservas">
        <div class="spread">
          <b>{c.open === 0 ? 'Todo reservado' : c.open === 1 ? 'Queda 1 cosa por hacer' : `Quedan ${c.open} cosas por hacer`}</b>
          <span class="chip num">{c.bought} de {c.total}</span>
        </div>
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={c.bought} aria-label="Reservas hechas"><i style={{ width: `${(c.bought / c.total) * 100}%` }} /></div>
        {c.soldout > 0 && <p class="small muted">{c.soldout === 1 ? '1 agotada' : `${c.soldout} agotadas`}: mira si hay cancelaciones o usa el plan B.</p>}
      </section>
      <p class="small muted">Los archivos que añadas se ven en los dos móviles y se pueden abrir sin conexión.</p>
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.title} class="stack" aria-label={g.title}>
          <h2>{g.title} <span class="chip num">{g.items.length}</span></h2>
          {g.items.map((r) => <ReservationCard key={r.id} r={r} st={statusOf(r)} note={(notes.get(r.id)?.value as string | undefined) ?? ''} now={now} />)}
        </section>
      ))}
    </div>
  );
}
