import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { timeline, type TimedStop } from '@/lib/schedule';

// Calendario .ics (F09): todas las paradas con alarma 30 min antes. Horas en UTC (Z).

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliega líneas largas a 75 octetos como pide RFC 5545. */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(stops: TimedStop[] = timeline(itinerary), now = Date.now()): string {
  const timed = stops.filter((s) => s.at !== null) as (TimedStop & { at: number })[];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roma//Viaje 2026//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Roma · 30 oct – 3 nov', 'X-WR-TIMEZONE:Europe/Rome'];
  timed.forEach((s, i) => {
    const next = timed[i + 1];
    // Fin: la siguiente parada del mismo día, con un máximo de 2 h; si no, 1 h.
    const end = next && next.date === s.date ? Math.min(next.at, s.at + 2 * 3600_000) : s.at + 3600_000;
    const place = s.placeId ? placeById.get(s.placeId) : undefined;
    const desc = [s.note, s.pending ? `Pendiente: ${s.pending}` : null].filter(Boolean).join(' · ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@roma-viaje`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(s.at)}`,
      `DTEND:${stamp(Math.max(end, s.at + 15 * 60_000))}`,
      `SUMMARY:${escapeText(s.title)}`,
      ...(place?.address || place?.name ? [`LOCATION:${escapeText([place.name, place.address].filter(Boolean).join(', '))}`] : []),
      ...(desc ? [`DESCRIPTION:${escapeText(desc)}`] : []),
      ...(place?.lat !== undefined && place.lng !== undefined ? [`GEO:${place.lat};${place.lng}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(s.title)}`, 'TRIGGER:-PT30M', 'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
