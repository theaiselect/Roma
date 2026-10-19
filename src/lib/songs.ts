// Canción del día: cada uno elige la suya; el enlace puede ser de cualquier servicio.

/** Devuelve el enlace limpio si es una dirección https válida; si no, cadena vacía. */
export function cleanSongUrl(raw: string): string {
  const t = raw.trim();
  if (!/^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(t)) return '';
  try { return new URL(t).toString(); } catch { return ''; }
}

/** Nombre del servicio para el botón («Abrir en Spotify»…). */
export function songService(url: string): string {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').replace(/^open\./, '').replace(/^music\./, ''); } catch { return 'el enlace'; }
  if (host.endsWith('spotify.com') || host === 'spotify.link') return 'Spotify';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host.endsWith('apple.com')) return 'Apple Music';
  if (host.endsWith('deezer.com') || host === 'deezer.page.link') return 'Deezer';
  return 'el enlace';
}

export function songSearchUrl(title: string, artist: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`.trim())}`;
}
