import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days, travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { appNow } from '@/lib/clock';
import { remove, save, useKind, type Entity } from '@/lib/db';
import { distanceM, geoHelp, locate } from '@/lib/geo';
import { isIOS } from '@/lib/maps';
import { useSettings } from '@/lib/settings';
import { romeParts, romeToUtc } from '@/lib/time';

export interface LetterEntity extends Entity {
  kind: 'letter';
  to: Who;
  text: string | null;
  /** Hora de Roma 'YYYY-MM-DDTHH:mm' a partir de la cual el servidor devuelve el texto. */
  unlockAt: string;
  unlockPlaceId?: string;
  radiusM: number;
  /** Tras esta hora se puede abrir «de todos modos» aunque no estéis en el sitio. */
  openAnywayAt?: string;
  opened?: boolean;
}

export interface CapsuleEntity extends Entity { kind: 'capsule'; text: string | null; unlockAt: string }

const at = (s: string) => { const [d, t = '00:00'] = s.split('T') as [string, string?]; return romeToUtc(d, t); };
const fmt = (s: string) => { const p = romeParts(at(s)); return `${p.d}/${p.m} a las ${p.time}`; };

function placeStops() {
  return itinerary.filter((s) => s.start && s.placeId && placeById.get(s.placeId)?.lat !== undefined && !s.leg);
}

function Compose({ onDone }: { onDone: () => void }) {
  const me = useSettings().profile ?? 'jesus';
  const to: Who = me === 'jesus' ? 'lucia' : 'jesus';
  const stops = placeStops();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'place' | 'time'>('place');
  const [stopId, setStopId] = useState(stops[0]?.id ?? '');
  const [when, setWhen] = useState('2026-10-31T21:00');

  const send = () => {
    if (mode === 'place') {
      const s = stops.find((x) => x.id === stopId)!;
      const date = days.find((d) => d.day === s.day)!.date;
      // Se puede abrir desde la hora de la parada; al terminar el día, de todos modos.
      void save({ kind: 'letter', to, text: text.trim(), unlockAt: `${date}T${s.start}`, unlockPlaceId: s.placeId, radiusM: 150, openAnywayAt: `${date}T23:59` });
    } else {
      void save({ kind: 'letter', to, text: text.trim(), unlockAt: when, radiusM: 150 });
    }
    onDone();
  };

  return (
    <section class="card stack">
      <h2>Carta para {travellers[to].name}</h2>
      <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Querida… / Querido…" style={{ minHeight: '10rem' }} aria-label="Carta" />
      <div class="segmented">
        <button type="button" aria-pressed={mode === 'place'} onClick={() => setMode('place')}>En un lugar</button>
        <button type="button" aria-pressed={mode === 'time'} onClick={() => setMode('time')}>A una hora</button>
      </div>
      {mode === 'place' ? (
        <label class="field small">Se abre allí (a menos de 150 m), desde la hora del plan
          <select value={stopId} onChange={(e) => setStopId((e.target as HTMLSelectElement).value)}>
            {stops.map((s) => <option key={s.id} value={s.id}>{days.find((d) => d.day === s.day)!.roman} · {s.start} · {s.title}</option>)}
          </select>
        </label>
      ) : (
        <label class="field small">Se abre a partir de
          <input type="datetime-local" value={when} min="2026-10-19T00:00" onInput={(e) => setWhen((e.target as HTMLInputElement).value)} />
        </label>
      )}
      <p class="small muted">Ni siquiera el servidor la entrega antes de la hora.</p>
      <div class="row">
        <button type="button" class="btn primary" disabled={!text.trim()} onClick={send}><Icon name="mail" /> Guardar carta</button>
        <button type="button" class="btn ghost" onClick={onDone}>Cancelar</button>
      </div>
    </section>
  );
}

function Received({ l }: { l: LetterEntity }) {
  const now = appNow();
  const timeOk = now >= at(l.unlockAt) && l.text !== null;
  const anyway = l.openAnywayAt ? now >= at(l.openAnywayAt) : true;
  const place = l.unlockPlaceId ? placeById.get(l.unlockPlaceId) : undefined;
  const [msg, setMsg] = useState<string | null>(null);

  const tryOpen = async () => {
    if (!place || anyway) { void save({ ...l, opened: true }); return; }
    const r = await locate();
    if (!r.ok) { setMsg(geoHelp(r.reason, isIOS())); return; }
    const d = distanceM(r.pos, { lat: place.lat!, lng: place.lng! });
    if (d <= l.radiusM) void save({ ...l, opened: true });
    else setMsg(`Todavía no: estás a ${Math.round(d)} m de ${place.name}. Se abre a menos de ${l.radiusM} m${l.openAnywayAt ? `, o de todos modos desde el ${fmt(l.openAnywayAt)}` : ''}.`);
  };

  if (l.opened && l.text) {
    return (
      <article class="card stack" style={{ background: 'color-mix(in srgb, var(--rosa-romano) 18%, var(--tarjeta))' }}>
        <p class="eyebrow">De {travellers[l.author].name}{place ? ` · ${place.name}` : ''}</p>
        <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>{l.text}</p>
      </article>
    );
  }
  return (
    <article class="card stack" style={{ gap: '0.4rem' }}>
      <div class="spread"><b>💌 Carta de {travellers[l.author].name}</b><span class="chip">{timeOk ? 'Lista' : 'Cerrada'}</span></div>
      <p class="small">{place ? `Se abre en ${place.name}, desde el ${fmt(l.unlockAt)}.` : `Se abre el ${fmt(l.unlockAt)}.`}</p>
      {timeOk && <button type="button" class="btn primary" onClick={() => void tryOpen()}>{place && !anyway ? 'Estoy aquí: abrir' : 'Abrir'}</button>}
      {!timeOk && now >= at(l.unlockAt) && <p class="small muted">Ya es la hora: hace falta conexión un momento para recibirla.</p>}
      {msg && <p class="small pending">{msg}</p>}
    </article>
  );
}

/** Cartas desbloqueables (F39). */
export function Letters() {
  const me = useSettings().profile ?? 'jesus';
  const letters = useKind<LetterEntity>('letter') ?? [];
  const [writing, setWriting] = useState(false);
  const received = letters.filter((l) => l.to === me);
  const sent = letters.filter((l) => l.author === me);
  return (
    <section class="stack">
      {writing ? <Compose onDone={() => setWriting(false)} /> : <button type="button" class="btn primary block" onClick={() => setWriting(true)}><Icon name="mail" /> Escribir una carta</button>}
      <h2>Para ti</h2>
      {received.length ? received.sort((a, b) => at(a.unlockAt) - at(b.unlockAt)).map((l) => <Received key={l.id} l={l} />) : <p class="muted small">Aún no hay cartas para ti.</p>}
      <h2>Las tuyas</h2>
      {sent.map((l) => (
        <article key={l.id} class="card spread">
          <span class="small">Para {travellers[l.to].name} · {l.unlockPlaceId ? `${placeById.get(l.unlockPlaceId)?.name}, ` : ''}{fmt(l.unlockAt)}</span>
          <button type="button" class="btn ghost" aria-label="Borrar carta" onClick={() => { if (confirm('¿Borrar esta carta?')) void remove(l.id); }}><Icon name="trash" /></button>
        </article>
      ))}
    </section>
  );
}

/** Cápsula del tiempo (F47): mensajes que se abren el 30 de octubre de 2027. */
export function Capsule() {
  const me = useSettings().profile ?? 'jesus';
  const items = useKind<CapsuleEntity>('capsule') ?? [];
  const [text, setText] = useState('');
  const openAt = romeToUtc('2027-10-30', '00:00');
  const open = appNow() >= openAt;
  const days_ = Math.ceil((openAt - appNow()) / 86_400_000);
  return (
    <section class="stack">
      <section class="card stack">
        <p class="eyebrow">Cápsula del tiempo</p>
        <h2>{open ? 'La cápsula está abierta' : `Se abre el 30 de octubre de 2027 (faltan ${days_} días)`}</h2>
        <p class="small muted">Escribid a vuestro «yo» de dentro de un año. Nadie, ni el servidor, puede leerlo antes.</p>
        {!open && (
          <>
            <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Dentro de un año…" aria-label="Mensaje para la cápsula" />
            <button type="button" class="btn primary" disabled={!text.trim()} onClick={() => { void save({ kind: 'capsule', text: text.trim(), unlockAt: '2027-10-30' }); setText(''); }}>Guardar en la cápsula</button>
          </>
        )}
      </section>
      <p class="small">{items.length} {items.length === 1 ? 'mensaje guardado' : 'mensajes guardados'} · {items.filter((i) => i.author === me).length} tuyos</p>
      {open && items.map((i) => (
        <article key={i.id} class="card stack">
          <p class="eyebrow">{travellers[i.author].name}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{i.text ?? 'Hace falta conexión un momento para abrirla.'}</p>
        </article>
      ))}
      <p class="small muted">Para que se pueda abrir, el proyecto tiene que seguir publicado en Vercel hasta esa fecha.</p>
    </section>
  );
}
