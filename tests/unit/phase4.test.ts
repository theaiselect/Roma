import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBookHtml, escapeHtml } from '@/lib/book';
import { checkConnection } from '@/lib/connection';
import { voiceIds, withVoice, withoutVoice } from '@/lib/diary';
import { blobIdsOf } from '@/lib/offline-data';
import { kmText, plannedKm } from '@/lib/plan-stats';
import { countReservations, reservationDate, sortReservations, untilText } from '@/lib/reservations';
import { matchStats } from '@/lib/reveal';
import { cleanSongUrl, songSearchUrl, songService } from '@/lib/songs';
import { reservations } from '@/data/reservations';
import type { Reservation, ReservationStatus } from '@/data/types';
import { wrapText } from '@/screens/us-postcard';

const R = (id: string, status: ReservationStatus, day?: Reservation['day'], time?: string): Reservation => ({ id, title: id, status, day, time });

describe('reservas: orden y resumen', () => {
  const list = [R('a', 'bought', 1, '09:00'), R('b', 'todo', 4, '08:00'), R('c', 'soldout'), R('d', 'pending', 2), R('e', 'todo', 2, '21:00'), R('f', 'todo')];
  const status = (r: Reservation) => r.status;
  it('primero lo que falta, luego pendientes de datos, agotadas y comprado', () => {
    expect(sortReservations(list, status).map((r) => r.id)).toEqual(['e', 'b', 'f', 'd', 'c', 'a']);
  });
  it('dentro de un grupo ordena por día y hora, y lo que no tiene día va al final', () => {
    const todo = sortReservations(list, status).filter((r) => r.status === 'todo');
    expect(todo.map((r) => r.id)).toEqual(['e', 'b', 'f']);
  });
  it('el estado cambiado en la app manda sobre el de los datos', () => {
    const override = (r: Reservation): ReservationStatus => (r.id === 'b' ? 'bought' : r.status);
    expect(sortReservations(list, override).at(-1)?.id).toBe('b');
    expect(countReservations(list, override)).toMatchObject({ todo: 2, pending: 1, soldout: 1, bought: 2, open: 3, total: 6 });
  });
  it('no modifica la lista original', () => {
    const copy = [...list];
    sortReservations(list, status);
    expect(list).toEqual(copy);
  });
  it('fecha del día del viaje y texto de cuenta atrás', () => {
    expect(reservationDate(R('x', 'todo', 2))).toBe('2026-10-31');
    expect(reservationDate(R('x', 'todo'))).toBeUndefined();
    expect([-1, 0, 1, 5].map(untilText)).toEqual(['ya pasó', 'hoy', 'mañana', 'en 5 días']);
  });
  it('los datos reales: ids únicos y el hotel está como comprado', () => {
    expect(new Set(reservations.map((r) => r.id)).size).toBe(reservations.length);
    expect(reservations.find((r) => r.id === 'hotel')?.status).toBe('bought');
  });
});

describe('plan: distancias', () => {
  it('formatea metros y kilómetros', () => {
    expect(kmText(0.46)).toBe('500 m');
    expect(kmText(4.24)).toBe('4,2 km');
  });
  it('cada día con paradas con sitio tiene kilómetros y el total los suma', () => {
    const total = plannedKm();
    const sum = [1, 2, 3, 4, 5].reduce((n, d) => n + plannedKm(d as 1), 0);
    expect(total).toBeGreaterThan(5);
    expect(Math.abs(total - sum)).toBeLessThan(0.001);
  });
});

describe('diario: notas de voz', () => {
  it('junta el formato antiguo y el nuevo sin repetir', () => {
    expect(voiceIds(undefined)).toEqual([]);
    expect(voiceIds({ voiceBlobId: 'a' })).toEqual(['a']);
    expect(voiceIds({ voiceBlobIds: ['a', 'b'], voiceBlobId: 'b' })).toEqual(['a', 'b']);
  });
  it('añadir conserva las anteriores (también la antigua) y quitar solo borra esa', () => {
    const e = { voiceBlobId: 'a' };
    expect(withVoice(e, 'b')).toEqual({ voiceBlobIds: ['a', 'b'], voiceBlobId: undefined });
    expect(withoutVoice({ voiceBlobIds: ['a', 'b'] }, 'a').voiceBlobIds).toEqual(['b']);
  });
  it('los archivos de una entrada, sueltos o en lista, se descargan para ir sin conexión', () => {
    expect(blobIdsOf({ voiceBlobIds: ['v1', 'v2'], blobId: 'b', photoBlobIds: ['p'], text: 'x' }).sort()).toEqual(['b', 'p', 'v1', 'v2']);
    expect(blobIdsOf({ voiceBlobId: 'old' })).toEqual(['old']);
  });
});

describe('canciones', () => {
  it('solo acepta enlaces https y los reconoce por servicio', () => {
    expect(cleanSongUrl(' https://open.spotify.com/track/abc?si=1 ')).toBe('https://open.spotify.com/track/abc?si=1');
    expect(cleanSongUrl('http://spotify.com/x')).toBe('');
    expect(cleanSongUrl('javascript:alert(1)')).toBe('');
    expect(cleanSongUrl('no es un enlace')).toBe('');
    expect(songService('https://open.spotify.com/track/abc')).toBe('Spotify');
    expect(songService('https://music.youtube.com/watch?v=1')).toBe('YouTube');
    expect(songService('https://youtu.be/xyz')).toBe('YouTube');
    expect(songService('https://music.apple.com/es/album/x')).toBe('Apple Music');
    expect(songService('https://ejemplo.org/a')).toBe('el enlace');
  });
  it('la búsqueda codifica título y artista', () => {
    expect(songSearchUrl('Roma', 'Los Planetas')).toBe('https://open.spotify.com/search/Roma%20Los%20Planetas');
  });
});

describe('votos: coincidencias', () => {
  const v = (topic: string, author: 'jesus' | 'lucia', choice: string | null, locked = false) => ({ topic, author, choice, locked });
  it('cuenta solo los temas con los dos votos ya revelados', () => {
    const votes = [
      v('t1', 'jesus', 'a'), v('t1', 'lucia', 'a'),
      v('t2', 'jesus', 'a'), v('t2', 'lucia', 'b'),
      v('t3', 'jesus', 'a'), v('t3', 'lucia', null, true),
      v('t4', 'jesus', 'a'),
    ];
    expect(matchStats(votes)).toEqual({ both: 2, same: 1 });
  });
  it('ignora votos borrados', () => {
    expect(matchStats([{ ...v('t', 'jesus', 'a'), deleted: true }, v('t', 'lucia', 'a')])).toEqual({ both: 0, same: 0 });
  });
});

describe('postal: texto en líneas', () => {
  const measure = (s: string) => s.length * 10;
  it('parte por palabras sin pasarse del ancho', () => {
    const lines = wrapText(measure, 'uno dos tres cuatro cinco seis', 100);
    expect(lines.every((l) => measure(l) <= 100)).toBe(true);
    expect(lines.join(' ')).toBe('uno dos tres cuatro cinco seis');
  });
  it('respeta los saltos de línea del autor', () => {
    expect(wrapText(measure, 'hola\namor', 1000)).toEqual(['hola', 'amor']);
  });
  it('una palabra más larga que la línea se queda sola, sin perderse', () => {
    expect(wrapText(measure, 'a supercalifragilistico b', 100)).toEqual(['a', 'supercalifragilistico', 'b']);
  });
});

describe('libro del viaje (archivo)', () => {
  const base = { title: 'Roma', subtitle: 'Jesús y Lucía', letters: [] };
  it('escapa el HTML de lo que escriben', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    const html = buildBookHtml({
      ...base,
      days: [{ roman: 'I', label: 'Viernes', diary: [{ who: 'Jesús', text: '<script>alert(1)</script>\nSegunda línea' }], songs: [], photos: [] }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<br>Segunda línea');
  });
  it('incluye fotos, canciones, cartas y marca los días en blanco', () => {
    const html = buildBookHtml({
      ...base,
      days: [
        { roman: 'I', label: 'Viernes', diary: [], songs: [{ who: 'Lucía', title: 'Roma', artist: 'X' }], photos: [{ src: 'data:image/jpeg;base64,AAAA', caption: 'Trevi' }] },
        { roman: 'II', label: 'Sábado', diary: [], songs: [], photos: [] },
      ],
      letters: [{ from: 'Lucía', where: 'Gianicolo', text: 'Te quiero' }],
      stats: [{ value: '12 km', label: 'andados' }],
    });
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('alt="Trevi"');
    expect(html).toContain('♪ Roma · X');
    expect(html).toContain('De Lucía · Gianicolo');
    expect(html).toContain('Este día quedó en blanco');
    expect(html).toContain('12 km');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
  it('una dirección de foto manipulada no puede cerrar el atributo', () => {
    const html = buildBookHtml({ ...base, days: [{ roman: 'I', label: 'L', diary: [], songs: [], photos: [{ src: 'x" onerror="alert(1)', caption: '' }] }] });
    expect(html).not.toContain('" onerror=');
  });
});

describe('probar conexión', () => {
  const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
  const health = { ok: true, tripCode: true, redis: true, blob: true };

  it('sin red lo dice sin llamar al servidor', async () => {
    const f = vi.fn();
    const r = await checkConnection({ tripCode: 'x', profile: 'jesus', online: false, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(r.steps[0]!.text).toContain('no tiene conexión');
  });
  it('todo bien: servidor, almacenes y código correcto', async () => {
    const f = vi.fn(async (url: string) => (url.startsWith('/api/health') ? res(200, health) : res(200, { entities: [] })));
    const r = await checkConnection({ tripCode: '15/06/2026', profile: 'lucia', online: true, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    expect(r.steps.at(-1)!.text).toContain('código es correcto');
    const [, init] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-trip-code']).toBe('15/06/2026');
    expect((init.headers as Record<string, string>)['x-who']).toBe('lucia');
  });
  it('código equivocado (401)', async () => {
    const f = vi.fn(async (url: string) => (url.startsWith('/api/health') ? res(200, health) : res(401)));
    const r = await checkConnection({ tripCode: 'mal', profile: 'jesus', online: true, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.steps.at(-1)!.text).toContain('no coincide');
  });
  it('falta Blob o Redis en el servidor', async () => {
    const f = vi.fn(async (url: string) => (url.startsWith('/api/health') ? res(200, { ...health, blob: false }) : res(200)));
    const r = await checkConnection({ tripCode: 'x', profile: 'jesus', online: true, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.steps.some((s) => !s.ok && s.text.includes('Blob'))).toBe(true);
  });
  it('sin código guardado no prueba el código', async () => {
    const f = vi.fn(async () => res(200, health));
    const r = await checkConnection({ tripCode: null, profile: 'jesus', online: true, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.steps.at(-1)!.text).toContain('Falta el código');
  });
  it('si el servidor no responde, lo dice y no sigue', async () => {
    const f = vi.fn(async () => { throw new TypeError('network'); });
    const r = await checkConnection({ tripCode: 'x', profile: 'jesus', online: true, fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.steps).toHaveLength(1);
  });
});

// ── Datos locales: guardar solo lo que cambia no pisa el resto ──
const target = new EventTarget();
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) }),
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
});

describe('diario: guardar un campo no borra los demás', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear(); globalThis.indexedDB = new IDBFactory(); });

  it('escribir texto después de grabar una nota de voz conserva la nota', async () => {
    const { save, getEntity } = await import('@/lib/db');
    await save({ id: 'diary:1:jesus', kind: 'diary', day: 1, author: 'jesus', text: 'hola', voiceBlobIds: ['v1'], lat: 41.9, lng: 12.5 });
    await save({ id: 'diary:1:jesus', kind: 'diary', day: 1, author: 'jesus', text: 'hola de nuevo' });
    const e = (await getEntity('diary:1:jesus'))!;
    expect(e.text).toBe('hola de nuevo');
    expect(e.voiceBlobIds).toEqual(['v1']);
    expect(e.lat).toBe(41.9);
  });

  it('guardar la ubicación después conserva el texto', async () => {
    const { save, getEntity } = await import('@/lib/db');
    await save({ id: 'diary:2:lucia', kind: 'diary', day: 2, author: 'lucia', text: 'día de Coliseo' });
    await save({ id: 'diary:2:lucia', kind: 'diary', day: 2, author: 'lucia', lat: 41.89, lng: 12.49 });
    expect((await getEntity('diary:2:lucia'))!.text).toBe('día de Coliseo');
  });
});
