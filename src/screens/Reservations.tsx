import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { telHref } from '@/components/StopCard';
import { reservations } from '@/data/reservations';
import { days } from '@/data/trip';
import type { ReservationStatus } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { setCheck, useChecks } from '@/lib/checks';
import { getBlob, putBlob, remove, save, useKind, type Entity } from '@/lib/db';

export interface TicketEntity extends Entity {
  kind: 'ticket';
  reservationId: string;
  blobId: string;
  mime: string;
  name: string;
}

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  bought: { label: 'Comprado', cls: 'ok' },
  pending: { label: 'Pendiente de datos', cls: 'warn' },
  todo: { label: 'Por hacer', cls: 'warn' },
  soldout: { label: 'Agotado', cls: 'bad' },
};

export async function openTicket(t: TicketEntity): Promise<void> {
  const blob = await getBlob(t.blobId);
  if (!blob) { alert('El archivo aún no se ha descargado en este móvil. Conéctate un momento y vuelve a intentarlo.'); return; }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareTicket(t: TicketEntity): Promise<void> {
  const blob = await getBlob(t.blobId);
  if (!blob) return;
  const file = new File([blob], t.name, { type: t.mime });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t.name }).catch(() => undefined);
  else void openTicket(t);
}

export function TicketList({ reservationId }: { reservationId: string }) {
  const tickets = (useKind<TicketEntity>('ticket') ?? []).filter((t) => t.reservationId === reservationId);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const blobId = await putBlob(f);
      await save({ kind: 'ticket', reservationId, blobId, mime: f.type || 'application/octet-stream', name: f.name });
    }
    setBusy(false);
  };
  return (
    <div class="stack" style={{ gap: '0.4rem' }}>
      {tickets.map((t) => (
        <div key={t.id} class="row">
          <button type="button" class="btn" onClick={() => void openTicket(t)}><Icon name="file" /> {t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name}</button>
          <button type="button" class="btn" aria-label="Compartir" onClick={() => void shareTicket(t)}><Icon name="share" /></button>
          <button type="button" class="btn ghost" aria-label="Quitar" onClick={() => { if (confirm('¿Quitar este archivo de los dos móviles?')) void remove(t.id); }}><Icon name="trash" /></button>
        </div>
      ))}
      <label class="btn ghost" style={{ justifyContent: 'flex-start' }}>
        <Icon name="plus" /> {busy ? 'Guardando…' : 'Añadir QR o PDF'}
        <input type="file" accept="image/*,application/pdf" multiple class="sr-only" onChange={(e) => void add((e.target as HTMLInputElement).files)} />
      </label>
    </div>
  );
}

export function Reservations() {
  const status = useChecks('reservations');
  return (
    <div class="stack-lg">
      <BackTitle title="Reservas y entradas" />
      <p class="small muted">Los archivos que añadas se ven en los dos móviles y se pueden abrir sin conexión.</p>
      {reservations.map((r) => {
        const st = (status.get(r.id)?.value as ReservationStatus | undefined) ?? r.status;
        const day = r.day ? days.find((d) => d.day === r.day) : undefined;
        return (
          <article key={r.id} class="card stack">
            <div class="spread">
              <h3>{r.title}</h3>
              <span class={`chip ${STATUS[st].cls}`}>{STATUS[st].label}</span>
            </div>
            {(day || r.time) && <p class="small num">{day ? `${day.roman} · ${day.label}` : ''}{r.time ? ` · ${r.time}` : ''}</p>}
            {r.note && <p class="small">{r.note}</p>}
            <div class="row">
              {r.url && <a class="btn" href={r.url} target="_blank" rel="noopener"><Icon name="link" /> Web oficial</a>}
              {r.phone && <a class="btn" href={telHref(r.phone)}><Icon name="phone" /> {r.phone}</a>}
            </div>
            <label class="field small">
              Estado
              <select value={st} onChange={(e) => void setCheck('reservations', r.id, true, { value: (e.target as HTMLSelectElement).value })}>
                {(Object.keys(STATUS) as ReservationStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
              </select>
            </label>
            <TicketList reservationId={r.id} />
          </article>
        );
      })}
    </div>
  );
}
