import { describe, expect, it } from 'vitest';
import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { dayAlerts } from '@/lib/alerts';
import { formatDuration, nowState, openStatus, timeline } from '@/lib/schedule';
import { legViews } from '@/lib/travel';
import { directionsUrl } from '@/lib/maps';
import { romeToUtc } from '@/lib/time';

const tl = timeline(itinerary);

describe('próxima parada (F01)', () => {
  it('el sábado a las 13:00 la siguiente es Da Enzo al 29, a 15 min', () => {
    const s = nowState(tl, romeToUtc('2026-10-31', '13:00'));
    expect(s.phase).toBe('during');
    expect(s.next?.id).toBe('d2-enzo');
    expect(s.current?.id).toBe('d2-foro');
    expect(s.msToNext).toBe(15 * 60_000);
  });

  it('antes del viaje la fase es «before» y la siguiente es el bus', () => {
    const s = nowState(tl, romeToUtc('2026-10-19', '01:30'));
    expect(s.phase).toBe('before');
    expect(s.next?.id).toBe('d1-bus');
  });

  it('justo a la hora de una parada, esa parada pasa a ser la actual', () => {
    const s = nowState(tl, romeToUtc('2026-10-31', '13:15'));
    expect(s.current?.id).toBe('d2-enzo');
    expect(s.next?.id).toBe('d2-ghetto');
  });

  it('el trapizzino de las 00:30 cae en la madrugada del domingo', () => {
    const t = tl.find((s) => s.id === 'd2-trapizzino')!;
    expect(t.date).toBe('2026-11-01');
    const s = nowState(tl, romeToUtc('2026-10-31', '23:50'));
    expect(s.next?.id).toBe('d2-trapizzino');
  });

  it('entre días, la siguiente es la primera del día siguiente', () => {
    const s = nowState(tl, romeToUtc('2026-11-01', '03:00'));
    expect(s.next?.id).toBe('d3-faro');
  });

  it('después de la última parada no hay siguiente', () => {
    const s = nowState(tl, romeToUtc('2026-11-04', '10:00'));
    expect(s.next).toBeNull();
    expect(s.phase).toBe('after');
  });

  it('formatea duraciones', () => {
    expect(formatDuration(15 * 60_000)).toBe('15 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 05 min');
    expect(formatDuration(0)).toBe('ahora');
    expect(formatDuration(26 * 3600_000)).toBe('1 d 2 h');
  });
});

describe('horarios', () => {
  it('Da Enzo cerrado el domingo, abierto el sábado a las 13:15', () => {
    const enzo = placeById.get('da-enzo')!;
    expect(openStatus(enzo, romeToUtc('2026-11-01', '13:15'))).toBe('closed-today');
    expect(openStatus(enzo, romeToUtc('2026-10-31', '13:15'))).toBe('open');
    expect(openStatus(enzo, romeToUtc('2026-10-31', '16:00'))).toBe('closed');
  });

  it('Ai Marmi (18:30–02:00) sigue abierto a la 01:00 del lunes y cierra el miércoles', () => {
    const m = placeById.get('ai-marmi')!;
    expect(openStatus(m, romeToUtc('2026-11-02', '01:00'))).toBe('open');
    expect(openStatus(m, romeToUtc('2026-11-04', '20:00'))).toBe('closed-today');
  });

  it('sin horario en el documento devuelve «unknown»', () => {
    expect(openStatus(placeById.get('ivo-trastevere')!, romeToUtc('2026-11-01', '20:00'))).toBe('unknown');
  });
});

describe('avisos del día (F04)', () => {
  it('el domingo avisa de que Da Enzo está cerrado y del festivo', () => {
    const text = dayAlerts(3, 'sun').map((a) => a.text).join(' ');
    expect(text).toContain('Da Enzo al 29');
    expect(text).toContain('Ognissanti');
  });

  it('el sábado avisa «Boccione (Shabbat)»', () => {
    const text = dayAlerts(2, 'sat').map((a) => a.text).join(' ');
    expect(text).toContain('Boccione (Shabbat)');
  });

  it('el lunes avisa de Two Sizes cerrado', () => {
    expect(dayAlerts(4, 'mon').map((a) => a.text).join(' ')).toContain('Two Sizes');
  });
});

describe('modo día de viaje (F03)', () => {
  const legs = tl.filter((s) => s.day === 1 && s.leg);

  it('margen verde, ocre y vino según los minutos que quedan', () => {
    const bus = legs[0]!; // 03:05
    expect(legViews(legs, new Set(), romeToUtc('2026-10-30', '02:30'))[0]).toMatchObject({ marginMin: 35, level: 'ok' });
    expect(legViews(legs, new Set(), romeToUtc('2026-10-30', '02:50'))[0]).toMatchObject({ marginMin: 15, level: 'tight' });
    expect(legViews(legs, new Set(), romeToUtc('2026-10-30', '03:10'))[0]).toMatchObject({ level: 'late' });
    expect(bus.id).toBe('d1-bus');
  });

  it('un tramo de hace más de una hora sin marcar no bloquea el margen', () => {
    const v = legViews(legs, new Set(), romeToUtc('2026-10-30', '07:30'));
    expect(v[0]).toMatchObject({ level: null });
    expect(v[1]).toMatchObject({ marginMin: 10, level: 'tight' });
  });

  it('al marcar un tramo, el margen pasa al siguiente', () => {
    const v = legViews(legs, new Set(['d1-bus']), romeToUtc('2026-10-30', '07:30'));
    expect(v[0]).toMatchObject({ done: true, level: null });
    expect(v[1]).toMatchObject({ marginMin: 10, level: 'tight' });
  });
});

describe('Cómo llegar (F19)', () => {
  const enzo = placeById.get('da-enzo')!;
  it('Google Maps a pie en Android', () => {
    expect(directionsUrl(enzo, false)).toBe('https://www.google.com/maps/dir/?api=1&destination=41.8880847%2C12.4778554&travelmode=walking');
  });
  it('Apple Maps a pie en iPhone', () => {
    expect(directionsUrl(enzo, true)).toBe('https://maps.apple.com/?daddr=41.8880847%2C12.4778554&dirflg=w');
  });
  it('sin coordenadas usa nombre y dirección', () => {
    expect(directionsUrl({ name: 'Panteón' }, false)).toContain('Pante%C3%B3n%2C%20Roma');
  });
});
