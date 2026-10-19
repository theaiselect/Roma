import { useState } from 'preact/hooks';
import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { Progress } from '@/components/Progress';
import { challenges } from '@/data/challenges';
import { travellers } from '@/data/trip';
import { appNow } from '@/lib/clock';
import { putBlob, remove, save, useKind, type Entity } from '@/lib/db';
import { locate } from '@/lib/geo';
import { compressImage } from '@/lib/image';

export interface PhotoEntity extends Entity { kind: 'photo'; blobId: string; challengeId?: string; caption: string; lat?: number; lng?: number; takenAt: number }

async function addPhoto(file: File, challengeId?: string, caption = ''): Promise<void> {
  const blobId = await putBlob(await compressImage(file));
  // La ubicación es opcional: si no hay permiso, la foto se guarda igual.
  const pos = await Promise.race([locate(6000), new Promise<null>((r) => window.setTimeout(() => r(null), 6500))]);
  const where = pos && pos.ok ? { lat: pos.pos.lat, lng: pos.pos.lng } : {};
  await save({ kind: 'photo', blobId, caption, takenAt: appNow(), ...(challengeId ? { challengeId } : {}), ...where });
}

function PhotoInput({ label, onFile, primary = false }: { label: string; onFile: (f: File) => void; primary?: boolean }) {
  return (
    <label class={`btn${primary ? ' primary' : ''}`}>
      <Icon name="camera" /> {label}
      <input type="file" accept="image/*" class="sr-only" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onFile(f); (e.target as HTMLInputElement).value = ''; }} />
    </label>
  );
}

/** Retos de fotos en pareja (F40) y galería compartida. */
export function Photos() {
  const photos = (useKind<PhotoEntity>('photo') ?? []).sort((a, b) => b.takenAt - a.takenAt);
  const [busy, setBusy] = useState<string | null>(null);
  const [heart, setHeart] = useState<string | null>(null);
  const [surprise, setSurprise] = useState<string | null>(null);
  const done = new Set(photos.map((p) => p.challengeId).filter(Boolean));
  const run = (id: string | undefined, f: File, caption = '') => {
    setBusy(id ?? 'free');
    void addPhoto(f, id, caption).then(() => { setBusy(null); if (id) { setHeart(id); window.setTimeout(() => setHeart(null), 900); } });
  };

  return (
    <section class="stack-lg">
      <section class="stack">
        <div class="spread"><h2>Retos</h2><span class="chip num">{done.size} de {challenges.length}</span></div>
        <Progress value={done.size} max={challenges.length} label="Retos completados" />
        {done.size < challenges.length && (
          <button type="button" class="btn" onClick={() => {
            const left = challenges.filter((c) => !done.has(c.id));
            const pick = left[Math.floor(Math.random() * left.length)]!;
            setSurprise(pick.id);
            window.setTimeout(() => document.getElementById(`reto-${pick.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
          }}><Icon name="star" /> Reto sorpresa</button>
        )}
        <ul class="list">
          {[...challenges].sort((x, y) => Number(done.has(x.id)) - Number(done.has(y.id))).map((c) => (
            <li key={c.id} id={`reto-${c.id}`} class={`card reto${surprise === c.id ? ' surprise' : ''}`}>
              <span class={done.has(c.id) ? 'strike' : undefined}>{c.text}</span>
              {heart === c.id && <span class="pop-heart" aria-hidden="true">♥</span>}
              {done.has(c.id)
                ? <span class="chip ok">Hecho</span>
                : <PhotoInput label={busy === c.id ? 'Guardando…' : 'Foto'} onFile={(f) => run(c.id, f, c.text)} />}
            </li>
          ))}
        </ul>
      </section>
      <section class="stack">
        <div class="spread"><h2>Fotos</h2><PhotoInput primary label={busy === 'free' ? 'Guardando…' : 'Añadir foto'} onFile={(f) => run(undefined, f)} /></div>
        {photos.length === 0 && <p class="muted small">Aún no hay fotos. Se comprimen en el móvil y se ven en los dos.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {photos.map((p) => (
            <figure key={p.id} class="card" style={{ margin: 0, padding: '0.4rem' }}>
              <BlobImage id={p.blobId} alt={p.caption || 'Foto del viaje'} style={{ aspectRatio: '1', objectFit: 'cover' }} />
              <figcaption class="small" style={{ padding: '0.3rem 0.2rem 0' }}>
                {p.caption && <span>{p.caption}<br /></span>}
                <span class="muted">{travellers[p.author].name}</span>
                <button type="button" class="btn ghost" style={{ minHeight: '36px', padding: '0 0.4rem', float: 'right' }} aria-label="Borrar foto" onClick={() => { if (confirm('¿Borrar esta foto de los dos móviles?')) void remove(p.id); }}><Icon name="trash" size={16} /></button>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </section>
  );
}
