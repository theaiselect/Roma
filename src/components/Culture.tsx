import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { audioguide, type Track } from '@/data/audioguide';
import { legends } from '@/data/legends';
import { speakSpanish, stopSpeaking } from '@/lib/tts';

/** Botón reproducir/pausa de la miniaudioguía (F28). */
const START = 'roma-track-start';

export function TrackButton({ track }: { track: Track }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { if (playing) stopSpeaking(); }, [playing]);
  // Si empieza otra audioguía, este botón vuelve a «Audioguía».
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail !== track.placeId) setPlaying(false); };
    window.addEventListener(START, on);
    return () => window.removeEventListener(START, on);
  }, [track.placeId]);
  return (
    <button type="button" class="btn" aria-pressed={playing} onClick={() => {
      if (playing) { stopSpeaking(); setPlaying(false); return; }
      window.dispatchEvent(new CustomEvent(START, { detail: track.placeId }));
      void speakSpanish(track.text, () => setPlaying(false)).then((ok) => setPlaying(ok));
    }}>
      <Icon name="speaker" /> {playing ? 'Parar' : 'Audioguía'}
    </button>
  );
}

/** Leyenda de amor (F29) y audioguía de una parada. */
export function PlaceCulture({ placeId }: { placeId: string }) {
  const ls = legends.filter((l) => l.placeId === placeId);
  const track = audioguide.find((t) => t.placeId === placeId);
  if (!ls.length && !track) return null;
  return (
    <div class="stack" style={{ gap: '0.4rem' }}>
      {ls.map((l) => (
        <details key={l.id} class="planb">
          <summary>♥ {l.title}</summary>
          <p class="small">{l.text}</p>
        </details>
      ))}
      {track && <div class="row"><TrackButton track={track} /><span class="small muted">{track.title}</span></div>}
    </div>
  );
}
