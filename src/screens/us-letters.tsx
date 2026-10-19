import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { useNow } from '@/lib/clock';
import { remove, save, useKind, type Entity } from '@/lib/db';
import { distanceM, geoHelp, locate } from '@/lib/geo';
import { isIOS } from '@/lib/maps';
import { timeline } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { requestSync } from '@/lib/sync';
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
const CAPSULE_AT = '2027-10-30';

/** Paradas con sitio y coordenadas donde se puede dejar una carta (con su fecha real, también las de madrugada). */
export function placeStops() {
  return timeline(itinerary).filter((s) => s.start && s.placeId && placeById.get(s.placeId)?.lat !== undefined && !s.leg);
}

const dayStart = (ms: number) => `${romeParts(ms).date}T00:00`;

function Compose({ onDone, initial }: { onDone: () => void; initial?: LetterEntity }) {
  const me = useSettings().profile ?? 'jesus';
  const to: Who = me === 'jesus' ? 'lucia' : 'jesus';
  const stops = placeStops();
  const initialStop = initial?.unlockPlaceId ? stops.find((x) => x.placeId === initial.unlockPlaceId && `${x.date}T${x.start}` === initial.unlockAt) : undefined;
  const [text, setText] = useState(initial?.text ?? '');
  const [mode, setMode] = useState<'place' | 'time'>(initial && !initialStop ? 'time' : 'place');
  const [stopId, setStopId] = useState(initialStop?.id ?? stops[0]?.id ?? '');
  const [when, setWhen] = useState(initial && !initialStop ? initial.unlockAt : '2026-10-31T21:00');
  const now = useNow(60_000);
  const past = mode === 'time' && when !== '' && at(when) <= now;

  const send = () => {
    const base = { ...(initial ? { id: initial.id } : {}), kind: 'letter' as const, to, text: text.trim(), radiusM: 150 };
    if (mode === 'place') {
      const s = stops.find((x) => x.id === stopId)!;
      // Se puede abrir desde la hora de la parada; al terminar el día, de todos modos.
      void save({ ...base, unlockAt: `${s.date}T${s.start}`, unlockPlaceId: s.placeId, openAnywayAt: `${s.date}T23:59` });
    } else {
      void save({ ...base, unlockAt: when, unlockPlaceId: undefined, openAnywayAt: undefined });
    }
    onDone();
  };

  return (
    <section class="card stack">
      <h2>{initial ? 'Editar la carta' : `Carta para ${travellers[to].name}`}</h2>
      <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Querida… / Querido…" style={{ minHeight: '10rem' }} aria-label="Carta" />
      <div class="segmented">
        <button type="button" aria-pressed={mode === 'place'} onClick={() => setMode('place')}>En un lugar</button>
        <button type="button" aria-pressed={mode === 'time'} onClick={() => setMode('time')}>A una hora</button>
      </div>
      {mode === 'place' ? (
        <label class="field small">Se abre allí (a menos de 150 m), desde la hora del plan
          <select value={stopId} onChange={(e) => setStopId((e.target as HTMLSelectElement).value)}>
            {stops.map((s) => <option key={s.id} value={s.id}>{s.date.slice(8)}/{s.date.slice(5, 7)} · {s.start} · {s.title}</option>)}
          </select>
        </label>
      ) : (
        <label class="field small">Se abre a partir de
          <input type="datetime-local" value={when} min={dayStart(now)} onInput={(e) => setWhen((e.target as HTMLInputElement).value)} />
        </label>
      )}
      {past && <p class="small pending">Esa hora ya ha pasado: la carta se podrá abrir nada más recibirla.</p>}
      <p class="small muted">Ni siquiera el servidor la entrega antes de la hora.</p>
      <div class="row">
        <button type="button" class="btn primary" disabled={!text.trim() || (mode === 'time' && !when)} onClick={send}><Icon name="mail" /> {initial ? 'Guardar cambios' : 'Guardar carta'}</button>
        <button type="button" class="btn ghost" onClick={onDone}>Cancelar</button>
      </div>
    </section>
  );
}

function Received({ l }: { l: LetterEntity }) {
  const now = useNow(30_000);
  const ready = now >= at(l.unlockAt);
  const timeOk = ready && l.text !== null;
  const anyway = l.openAnywayAt ? now >= at(l.openAnywayAt) : true;
  const place = l.unlockPlaceId ? placeById.get(l.unlockPlaceId) : undefined;
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const waiting = ready && l.text === null;

  // Llegó la hora pero el texto aún no está en este móvil: se pide al servidor sin esperar al ciclo de 30 s.
  useEffect(() => { if (waiting) void requestSync(true); }, [waiting]);

  const tryOpen = async () => {
    if (!place || anyway) { void save({ ...l, opened: true }); return; }
    setChecking(true);
    setMsg(null);
    const r = await locate();
    setChecking(false);
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
      <div class="spread"><b>💌 Carta de {travellers[l.author].name}</b><span class={`chip${timeOk ? ' ok' : ''}`}>{timeOk ? 'Lista' : 'Cerrada'}</span></div>
      <p class="small">{place ? `Se abre en ${place.name}, desde el ${fmt(l.unlockAt)}.` : `Se abre el ${fmt(l.unlockAt)}.`}</p>
      {timeOk && <button type="button" class="btn primary" disabled={checking} onClick={() => void tryOpen()}>{checking ? 'Buscando tu ubicación…' : place && !anyway ? 'Estoy aquí: abrir' : 'Abrir'}</button>}
      {waiting && <p class="small muted">Ya es la hora: hace falta conexión un momento para recibirla.</p>}
      {msg && <p class="small pending" role="status">{msg}</p>}
    </article>
  );
}

/** Cartas desbloqueables (F39). */
export function Letters() {
  const me = useSettings().profile ?? 'jesus';
  const letters = useKind<LetterEntity>('letter') ?? [];
  const now = useNow(30_000);
  const [writing, setWriting] = useState<LetterEntity | 'new' | null>(null);
  const received = letters.filter((l) => l.to === me).sort((a, b) => at(a.unlockAt) - at(b.unlockAt));
  const sent = letters.filter((l) => l.author === me).sort((a, b) => at(a.unlockAt) - at(b.unlockAt));
  return (
    <section class="stack">
      {writing
        ? <Compose key={writing === 'new' ? 'new' : writing.id} initial={writing === 'new' ? undefined : writing} onDone={() => setWriting(null)} />
        : <button type="button" class="btn primary block" onClick={() => setWriting('new')}><Icon name="mail" /> Escribir una carta</button>}
      <h2>Para ti</h2>
      {received.length ? received.map((l) => <Received key={l.id} l={l} />) : <p class="muted small">Aún no hay cartas para ti.</p>}
      <h2>Las tuyas</h2>
      {sent.length === 0 && <p class="muted small">Todavía no has escrito ninguna.</p>}
      {sent.map((l) => {
        const editable = l.text !== null && !l.opened && now < at(l.unlockAt);
        return (
          <article key={l.id} class="card stack" style={{ gap: '0.4rem' }}>
            <div class="spread">
              <span class="small">Para {travellers[l.to].name} · {l.unlockPlaceId ? `${placeById.get(l.unlockPlaceId)?.name}, ` : ''}{fmt(l.unlockAt)}</span>
              <span class={`chip${l.opened ? ' ok' : ''}`}>{l.opened ? 'Abierta ♥' : now >= at(l.unlockAt) ? 'Lista para abrir' : 'Cerrada'}</span>
            </div>
            <div class="row">
              {editable && <button type="button" class="btn" onClick={() => setWriting(l)}>Editar</button>}
              <button type="button" class="btn ghost" aria-label="Borrar carta" onClick={() => { if (confirm('¿Borrar esta carta?')) void remove(l.id); }}><Icon name="trash" /> Borrar</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

/** Cápsula del tiempo (F47): mensajes que se abren el 30 de octubre de 2027. */
export function Capsule() {
  const me = useSettings().profile ?? 'jesus';
  const items = useKind<CapsuleEntity>('capsule') ?? [];
  const [text, setText] = useState('');
  const now = useNow(60_000);
  const openAt = romeToUtc(CAPSULE_AT, '00:00');
  const open = now >= openAt;
  const days_ = Math.ceil((openAt - now) / 86_400_000);
  const mine = items.filter((i) => i.author === me);
  const waiting = open && items.some((i) => i.text === null);
  useEffect(() => { if (waiting) void requestSync(true); }, [waiting]);
  return (
    <section class="stack">
      <section class="card stack">
        <p class="eyebrow">Cápsula del tiempo</p>
        <h2>{open ? 'La cápsula está abierta' : `Se abre el 30 de octubre de 2027 (faltan ${days_} días)`}</h2>
        <p class="small muted">Escribid a vuestro «yo» de dentro de un año. Nadie, ni el servidor, puede leerlo antes.</p>
        {!open && (
          <>
            <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Dentro de un año…" aria-label="Mensaje para la cápsula" />
            <button type="button" class="btn primary" disabled={!text.trim()} onClick={() => { void save({ kind: 'capsule', text: text.trim(), unlockAt: CAPSULE_AT }); setText(''); }}>Guardar en la cápsula</button>
          </>
        )}
      </section>
      <p class="small">{items.length} {items.length === 1 ? 'mensaje guardado' : 'mensajes guardados'} · {mine.length} tuyos</p>
      {!open && mine.map((i) => (
        <article key={i.id} class="card spread">
          <span class="small">Tu mensaje del {new Date(i.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} · guardado en secreto</span>
          <button type="button" class="btn ghost" aria-label="Borrar mensaje de la cápsula" onClick={() => { if (confirm('¿Borrar este mensaje de la cápsula?')) void remove(i.id); }}><Icon name="trash" /></button>
        </article>
      ))}
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
