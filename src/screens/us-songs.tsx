import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { days, travellers } from '@/data/trip';
import type { DayNum } from '@/data/types';
import { save, useKind, type Entity } from '@/lib/db';
import { useOnline } from '@/lib/online';
import { useSettings } from '@/lib/settings';
import { cleanSongUrl, songSearchUrl, songService } from '@/lib/songs';

export interface SongEntity extends Entity { kind: 'song'; day: DayNum; title: string; artist: string; url: string }

/** Canción del día (F45): cada uno elige la suya; con conexión se abre el enlace o se busca; sin ella, título y artista. */
export function Songs() {
  const me = useSettings().profile ?? 'jesus';
  const songs = useKind<SongEntity>('song') ?? [];
  const [editing, setEditing] = useState<DayNum | null>(null);
  const [f, setF] = useState({ title: '', artist: '', url: '' });
  const online = useOnline();
  const badUrl = f.url.trim() !== '' && cleanSongUrl(f.url) === '';
  return (
    <section class="stack">
      {days.map((d) => {
        const ofDay = songs.filter((x) => x.day === d.day).sort((a, b) => Number(b.author === me) - Number(a.author === me));
        const mine = ofDay.find((x) => x.author === me);
        return (
          <article key={d.day} class="card stack" style={{ gap: '0.5rem' }}>
            <div class="spread">
              <b>{d.roman} · {d.label}</b>
              <button type="button" class="btn ghost" onClick={() => { setEditing(editing === d.day ? null : d.day); setF({ title: mine?.title ?? '', artist: mine?.artist ?? '', url: mine?.url ?? '' }); }}>{editing === d.day ? 'Cerrar' : mine ? 'Cambiar la mía' : 'Elegir'}</button>
            </div>
            {ofDay.length === 0 && <p class="small muted">Aún no hay canción para este día.</p>}
            {ofDay.map((s) => (
              <div key={s.id} class="stack" style={{ gap: '0.3rem' }}>
                <div class="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <Icon name="music" />
                  <span><b>{s.title}</b>{s.artist ? ` · ${s.artist}` : ''} <span class="small muted">({s.author === me ? 'la tuya' : `la de ${travellers[s.author].name}`})</span></span>
                </div>
                {online
                  ? <a class="btn" href={s.url || songSearchUrl(s.title, s.artist)} target="_blank" rel="noopener"><Icon name="link" /> {s.url ? `Abrir en ${songService(s.url)}` : 'Buscar en Spotify'}</a>
                  : <p class="small muted">Sin conexión: ponla cuando volváis a tener datos.</p>}
              </div>
            ))}
            {editing === d.day && (
              <div class="stack" style={{ gap: '0.4rem' }}>
                <input type="text" placeholder="Título" value={f.title} onInput={(e) => setF({ ...f, title: (e.target as HTMLInputElement).value })} aria-label="Título" />
                <input type="text" placeholder="Artista" value={f.artist} onInput={(e) => setF({ ...f, artist: (e.target as HTMLInputElement).value })} aria-label="Artista" />
                <input type="text" inputMode="url" placeholder="Enlace (Spotify, YouTube…; opcional)" value={f.url} onInput={(e) => setF({ ...f, url: (e.target as HTMLInputElement).value })} aria-label="Enlace" />
                {badUrl && <p class="small pending" role="status">Ese enlace no vale: tiene que empezar por https://. Si lo dejas así, se guarda sin enlace.</p>}
                <button type="button" class="btn primary" disabled={!f.title.trim()} onClick={() => {
                  void save({ id: mine?.id ?? `song:${d.day}:${me}`, kind: 'song', author: me, day: d.day, title: f.title.trim(), artist: f.artist.trim(), url: cleanSongUrl(f.url) });
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
