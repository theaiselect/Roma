import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { VoiceNote, VoiceRecorder } from '@/components/Voice';
import { days, travellers } from '@/data/trip';
import type { DayNum, Who } from '@/data/types';
import { appNow } from '@/lib/clock';
import { save, useKind, type Entity } from '@/lib/db';
import { locate } from '@/lib/geo';
import { useSettings } from '@/lib/settings';
import { romeParts } from '@/lib/time';

export interface DiaryEntity extends Entity { kind: 'diary'; day: DayNum; text: string; voiceBlobId?: string; photoBlobIds?: string[]; lat?: number; lng?: number }

const WHO: Who[] = ['jesus', 'lucia'];

function MyEntry({ day, entry }: { day: DayNum; entry?: DiaryEntity }) {
  const me = useSettings().profile ?? 'jesus';
  const [text, setText] = useState(entry?.text ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | null>(null);
  useEffect(() => { if (saved) setText(entry?.text ?? ''); }, [entry?.text]);

  const persist = (value: string, extra: Partial<DiaryEntity> = {}) =>
    save({ ...(entry ?? {}), id: `diary:${day}:${me}`, kind: 'diary', day, text: value, author: me, ...extra }).then(() => setSaved(true));

  const onInput = (v: string) => {
    setText(v);
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persist(v), 1200);
  };

  const addPlace = async () => {
    const r = await locate();
    if (r.ok) await persist(text, { lat: r.pos.lat, lng: r.pos.lng });
    else alert('No se ha podido saber la ubicación.');
  };

  return (
    <div class="card stack" style={{ gap: '0.5rem' }}>
      <div class="spread"><b>Tu versión del día</b><span class="small muted">{saved ? 'Guardado' : 'Escribiendo…'}</span></div>
      <textarea value={text} placeholder="¿Cómo ha sido el día?" onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} onBlur={() => { if (!saved) void persist(text); }} aria-label="Tu diario de hoy" />
      <VoiceRecorder onSaved={(blobId) => void persist(text, { voiceBlobId: blobId })} />
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
  const of = (w: Who) => entries.find((e) => e.day === day && e.author === w);

  return (
    <section class="stack">
      <div class="legend" role="group" aria-label="Día">
        {days.map((d) => <button type="button" key={d.day} aria-pressed={d.day === day} onClick={() => setDay(d.day)}>{d.roman}</button>)}
      </div>
      <h2>{days.find((d) => d.day === day)!.label}</h2>
      <div class="voices">
        {WHO.map((w) => {
          const e = of(w);
          return (
            <div key={w} class="card stack" style={{ gap: '0.4rem' }}>
              <b>{travellers[w].name}{w === me ? ' (tú)' : ''}</b>
              {e?.text ? <p class="small" style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p> : <p class="small muted">{w === me ? 'Escribe abajo.' : 'Aún no ha escrito.'}</p>}
              {e?.voiceBlobId && <VoiceNote blobId={e.voiceBlobId} />}
            </div>
          );
        })}
      </div>
      <MyEntry key={`${day}-${me}`} day={day} entry={of(me)} />
    </section>
  );
}
