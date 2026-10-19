import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { VoiceNote, VoiceRecorder } from '@/components/Voice';
import { days, travellers } from '@/data/trip';
import type { DayNum, Who } from '@/data/types';
import { appNow } from '@/lib/clock';
import { voiceIds, withVoice, withoutVoice } from '@/lib/diary';
import { getEntity, save, useKind, type Entity } from '@/lib/db';
import { locate } from '@/lib/geo';
import { pointUrl } from '@/lib/maps';
import { useSettings } from '@/lib/settings';
import { romeParts } from '@/lib/time';

export interface DiaryEntity extends Entity { kind: 'diary'; day: DayNum; text: string; voiceBlobId?: string; voiceBlobIds?: string[]; photoBlobIds?: string[]; lat?: number; lng?: number }

const WHO: Who[] = ['jesus', 'lucia'];
const entryId = (day: DayNum, who: Who) => `diary:${day}:${who}`;

/** Guarda solo los campos que cambian: `save` ya los mezcla con lo que haya en la base de datos (nada se pisa). */
function patch(day: DayNum, who: Who, fields: Partial<DiaryEntity>): Promise<Entity> {
  return save({ id: entryId(day, who), kind: 'diary', day, author: who, ...fields });
}

function MyEntry({ day, entry }: { day: DayNum; entry?: DiaryEntity }) {
  const me = useSettings().profile ?? 'jesus';
  const [text, setText] = useState(entry?.text ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);
  const latest = useRef(text);
  latest.current = text;

  // Cambios que llegan de fuera (restaurar copia, sincronizar) solo se ven si no hay nada a medias.
  useEffect(() => { if (!dirty.current) setText(entry?.text ?? ''); }, [entry?.text]);

  const flush = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    return patch(day, me, { text: latest.current }).then(() => setSaved(true)).catch(() => { dirty.current = true; });
  };

  // Lo escrito no se pierde al cambiar de día/pantalla ni al bloquear el móvil o pasar a otra app.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', hide); void flush(); };
  }, []);

  const onInput = (v: string) => {
    setText(v);
    setSaved(false);
    dirty.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 1200);
  };

  const addPlace = async () => {
    const r = await locate();
    if (r.ok) await patch(day, me, { lat: r.pos.lat, lng: r.pos.lng });
    else alert('No se ha podido saber la ubicación. Mira que el permiso de ubicación esté activo para esta web.');
  };

  const addVoice = async (blobId: string) => {
    const cur = (await getEntity(entryId(day, me))) as DiaryEntity | undefined;
    await patch(day, me, withVoice(cur, blobId));
  };

  const removeVoice = async (blobId: string) => {
    if (!confirm('¿Borrar esta nota de voz?')) return;
    const cur = (await getEntity(entryId(day, me))) as DiaryEntity | undefined;
    await patch(day, me, withoutVoice(cur, blobId));
  };

  const mine = voiceIds(entry);
  return (
    <div class="card stack" style={{ gap: '0.5rem' }}>
      <div class="spread"><b>Tu versión del día</b><span class="small muted" role="status">{saved ? 'Guardado' : 'Escribiendo…'}</span></div>
      <textarea value={text} placeholder="¿Cómo ha sido el día?" onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} onBlur={() => void flush()} aria-label="Tu diario de hoy" />
      {mine.map((id, i) => (
        <div key={id} class="row" style={{ flexWrap: 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}><VoiceNote blobId={id} /></div>
          <button type="button" class="btn ghost" aria-label={`Borrar nota de voz ${i + 1}`} onClick={() => void removeVoice(id)}><Icon name="trash" /></button>
        </div>
      ))}
      <VoiceRecorder onSaved={(blobId) => void addVoice(blobId)} />
      <button type="button" class="btn ghost" onClick={() => void addPlace()}><Icon name="pin" /> {entry?.lat ? 'Ubicación guardada · actualizar' : 'Guardar dónde estamos'}</button>
    </div>
  );
}

/** Diario a dos voces (F41): cada uno escribe su versión del día; se ven lado a lado. */
export function Diary() {
  const me = useSettings().profile ?? 'jesus';
  const entries = useKind<DiaryEntity>('diary') ?? [];
  const today = days.find((d) => d.date === romeParts(appNow()).date);
  const [day, setDay] = useState<DayNum>(today?.day ?? 1);
  const of = (w: Who, d: DayNum = day) => entries.find((e) => e.day === d && e.author === w);
  const written = (d: DayNum) => WHO.filter((w) => {
    const e = of(w, d);
    return Boolean(e?.text?.trim() || voiceIds(e).length);
  }).length;

  return (
    <section class="stack">
      <div class="legend" role="group" aria-label="Día">
        {days.map((d) => {
          const n = written(d.day);
          return (
            <button type="button" key={d.day} aria-pressed={d.day === day}
              aria-label={`${d.label}${today?.day === d.day ? ' (hoy)' : ''}${n === 2 ? ', escrito por los dos' : n === 1 ? ', escrito por uno' : ''}`}
              onClick={() => setDay(d.day)}>
              {d.roman}{n === 2 ? ' ♥' : n === 1 ? ' ·' : ''}
            </button>
          );
        })}
      </div>
      <h2>{days.find((d) => d.day === day)!.label}</h2>
      <div class="voices">
        {WHO.map((w) => {
          const e = of(w);
          return (
            <div key={w} class="card stack" style={{ gap: '0.4rem' }}>
              <b>{travellers[w].name}{w === me ? ' (tú)' : ''}</b>
              {e?.text ? <p class="small" style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p> : <p class="small muted">{w === me ? 'Escribe abajo.' : 'Aún no ha escrito.'}</p>}
              {w !== me && voiceIds(e).map((id) => <VoiceNote key={id} blobId={id} />)}
              {w === me && voiceIds(e).length > 0 && <p class="small muted">{voiceIds(e).length === 1 ? '1 nota de voz (abajo)' : `${voiceIds(e).length} notas de voz (abajo)`}</p>}
              {e?.lat !== undefined && e?.lng !== undefined && <a class="small" href={pointUrl(e.lat, e.lng)} target="_blank" rel="noopener"><Icon name="pin" size={14} /> Ver dónde estaba</a>}
            </div>
          );
        })}
      </div>
      <MyEntry key={`${day}-${me}`} day={day} entry={of(me)} />
    </section>
  );
}
