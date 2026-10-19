// Libro del viaje como archivo único (HTML con las fotos incrustadas): se abre en cualquier móvil u ordenador,
// funciona sin conexión y se puede imprimir o guardar como PDF desde allí.

export interface BookDay {
  roman: string;
  label: string;
  diary: { who: string; text: string }[];
  songs: { who: string; title: string; artist: string }[];
  /** `src` ya es una dirección de datos (data:image/jpeg;base64,…). */
  photos: { src: string; caption: string }[];
}

export interface BookInput {
  title: string;
  subtitle: string;
  days: BookDay[];
  letters: { from: string; where?: string; text: string }[];
  stats?: { label: string; value: string }[];
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const para = (s: string) => escapeHtml(s).replace(/\n/g, '<br>');

export function buildBookHtml(b: BookInput): string {
  const stats = (b.stats ?? []).map((s) => `<div><b>${escapeHtml(s.value)}</b><span>${escapeHtml(s.label)}</span></div>`).join('');
  const days = b.days.map((d) => {
    const empty = !d.diary.length && !d.songs.length && !d.photos.length;
    return `<section class="day">
<h2>${escapeHtml(d.roman)} · ${escapeHtml(d.label)}</h2>
${d.diary.map((e) => `<p class="who">${escapeHtml(e.who)}</p><p>${para(e.text)}</p>`).join('\n')}
${d.songs.map((s) => `<p class="song">♪ ${escapeHtml(s.title)}${s.artist ? ` · ${escapeHtml(s.artist)}` : ''} <small>(${escapeHtml(s.who)})</small></p>`).join('\n')}
${d.photos.length ? `<div class="photos">${d.photos.map((p) => `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.caption || 'Foto del viaje')}">`).join('')}</div>` : ''}
${empty ? '<p class="empty">Este día quedó en blanco.</p>' : ''}
</section>`;
  }).join('\n');
  const letters = b.letters.length
    ? `<section class="day"><h2>Cartas</h2>${b.letters.map((l) => `<blockquote><p class="who">De ${escapeHtml(l.from)}${l.where ? ` · ${escapeHtml(l.where)}` : ''}</p><p>${para(l.text)}</p></blockquote>`).join('')}</section>`
    : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(b.title)}</title>
<style>
body{margin:0;background:#F7F3EE;color:#2B2522;font:17px/1.55 Georgia,'Times New Roman',serif}
main{max-width:40rem;margin:0 auto;padding:1.5rem 1rem 3rem}
h1{font-size:2.4rem;margin:.2em 0;color:#C0583A;letter-spacing:.08em}
h2{font-size:1.5rem;margin:0 0 .5rem}
.sub{color:#6F655E;margin:0 0 1.5rem}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 0 2rem}
.stats div{background:#fff;border-radius:12px;padding:.7rem .9rem}.stats b{display:block;font-size:1.6rem;color:#C0583A}.stats span{font-size:.85rem;color:#6F655E}
.day{background:#fff;border-radius:14px;padding:1rem 1.1rem;margin:0 0 1.1rem;break-inside:avoid}
.who{font:600 .85rem system-ui,sans-serif;color:#6F655E;margin:.8rem 0 .1rem;text-transform:uppercase;letter-spacing:.05em}
.song{font-size:.95rem;margin:.6rem 0 0}.empty{color:#6F655E;font-style:italic}
.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.8rem}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
blockquote{margin:.8rem 0;padding:.2rem 0 .2rem 1rem;border-left:3px solid #C0583A}
@media print{body{background:#fff}.day{box-shadow:none;border:1px solid #ddd}}
</style></head><body><main>
<h1>${escapeHtml(b.title)}</h1><p class="sub">${escapeHtml(b.subtitle)}</p>
${stats ? `<div class="stats">${stats}</div>` : ''}
${days}
${letters}
</main></body></html>`;
}
