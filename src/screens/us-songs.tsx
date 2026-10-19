import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { days, travellers } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { save, useKind, type Entity } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export interface SongEntity extends Entity { kind: 'song'; day: DayNum; title: string; artist: string; url: string }

/** Canción del día (F45): con conexión abre Spotify; sin ella, título y artista. */
export function Songs() {
  const songs = useKind<SongEntity>('song') ?? [];
  const [editing, setEditing] = useState<DayNum | null>(null);
  const [f, setF] = useState({ title: '', artist: '', url: '' });
  const online = navigator.onLine;
  return (
    <section class="stack">
      {days.map((d) => {
        const s = songs.find((x) => x.day === d.day);
        return (
          <article key={d.day} class="card stack" style={{ gap: '0.4rem' }}>
            <div class="spread"><b>{d.roman} · {d.label}</b><button type="button" class="btn ghost" onClick={() => { setEditing(d.day); setF({ title: s?.title ?? '', artist: s?.artist ?? '', url: s?.url ?? '' }); }}>{s ? 'Cambiar' : 'Elegir'}</button></div>
            {s && (
              <div class="row">
                <Icon name="music" />
                <span><b>{s.title}</b> · {s.artist} <span class="small muted">(elegida por {travellers[s.author].name})</span></span>
              </div>
            )}
            {s?.url && (online
              ? <a class="btn" href={s.url} target="_blank" rel="noopener">Abrir en Spotify</a>
              : <p class="small muted">Sin conexión: ponla cuando volváis a tener datos.</p>)}
            {editing === d.day && (
              <div class="stack" style={{ gap: '0.4rem' }}>
                <input type="text" placeholder="Título" value={f.title} onInput={(e) => setF({ ...f, title: (e.target as HTMLInputElement).value })} aria-label="Título" />
                <input type="text" placeholder="Artista" value={f.artist} onInput={(e) => setF({ ...f, artist: (e.target as HTMLInputElement).value })} aria-label="Artista" />
                <input type="text" inputMode="url" placeholder="Enlace de Spotify (opcional)" value={f.url} onInput={(e) => setF({ ...f, url: (e.target as HTMLInputElement).value })} aria-label="Enlace" />
                <button type="button" class="btn primary" disabled={!f.title.trim()} onClick={() => {
                  const url = /^https:\/\/(open\.)?spotify\.com\//.test(f.url.trim()) || /^https:\/\/spotify\.link\//.test(f.url.trim()) ? f.url.trim() : '';
                  void save({ id: `song:${d.day}`, kind: 'song', author: getSettings().profile ?? 'jesus', day: d.day, title: f.title.trim(), artist: f.artist.trim(), url });
                  setEditing(null);
                }}>Guardar</button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
