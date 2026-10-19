import { describe, expect, it } from 'vitest';
import { placeById } from '@/data/places';
import { arrival, distanceM, walkingMinutes } from '@/lib/geo';
import { buildIcs, escapeText, fold } from '@/lib/ics';
import { lastMetroWarning, metroClosing } from '@/lib/metro';
import { sunsetAt } from '@/lib/sun';
import { romeParts, romeToUtc } from '@/lib/time';

const p = (id: string) => { const x = placeById.get(id)!; return { lat: x.lat!, lng: x.lng! }; };

describe('distancias a pie (geo.ts)', () => {
  it('Da Enzo → Felice: unos 1,1 km en línea recta', () => {
    const d = distanceM(p('da-enzo'), p('felice-testaccio'));
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });
  it('tiempo a pie a 4,5 km/h × 1,3 por calles', () => {
    // 1 km recto → 1,3 km → 17,3 min → 18 min
    const a = { lat: 41.9, lng: 12.5 };
    const b = { lat: 41.9 + 1000 / 111_195, lng: 12.5 };
    expect(walkingMinutes(a, b)).toBe(18);
  });
  it('¿llego a tiempo? margen positivo y negativo', () => {
    const a = { lat: 41.9, lng: 12.5 };
    const b = { lat: 41.9 + 1000 / 111_195, lng: 12.5 };
    expect(arrival(a, b, 0, 30 * 60_000).marginMin).toBe(12);
    expect(arrival(a, b, 0, 10 * 60_000).marginMin).toBe(-8);
  });
});

describe('atardecer (SunCalc)', () => {
  // Referencia publicada (solarwatch.app): 25 oct 17:15, 17 nov 16:49.
  it('coincide con la tabla publicada (±2 min)', () => {
    const min = (date: string) => { const t = romeParts(sunsetAt(date)); return t.h * 60 + t.mi; };
    expect(Math.abs(min('2026-10-25') - (17 * 60 + 15))).toBeLessThanOrEqual(2);
    expect(Math.abs(min('2026-11-17') - (16 * 60 + 49))).toBeLessThanOrEqual(2);
  });
  it('1 nov en Roma ≈ 17:0x (el plan pone el Gianicolo a las 16:45)', () => {
    expect(romeParts(sunsetAt('2026-11-01')).time).toMatch(/^17:0\d$/);
  });
});

describe('último metro (F16)', () => {
  it('domingo a las 23:00 avisa de que cierra a las 23:30', () => {
    expect(lastMetroWarning(romeToUtc('2026-11-01', '23:00'))).toBe('El metro cierra a las 23:30 (quedan 30 min).');
  });
  it('sábado de madrugada (00:45 del domingo) cierra a las 01:30', () => {
    expect(romeParts(metroClosing(romeToUtc('2026-11-01', '00:45'))).time).toBe('01:30');
    expect(lastMetroWarning(romeToUtc('2026-11-01', '00:45'))).toContain('01:30');
  });
  it('a media tarde no hay aviso', () => {
    expect(lastMetroWarning(romeToUtc('2026-11-01', '18:00'))).toBeNull();
  });
});

describe('calendario .ics', () => {
  const ics = buildIcs(undefined, Date.UTC(2026, 9, 19));
  it('tiene cabecera, eventos con alarma de 30 min y CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true);
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics.split('BEGIN:VEVENT').length - 1).toBeGreaterThan(50);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('Da Enzo el 31 a las 13:15 de Roma = 12:15 UTC', () => {
    expect(ics).toContain('UID:d2-enzo@roma-viaje\r\nDTSTAMP:20261019T000000Z\r\nDTSTART:20261031T121500Z');
  });
  it('escapa y pliega como RFC 5545', () => {
    expect(escapeText('a, b; c\nd')).toBe('a\\, b\\; c\\nd');
    const long = fold('DESCRIPTION:' + 'á'.repeat(80));
    expect(long.split('\r\n ').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('modo lluvia (F06)', async () => {
  const { applyRain } = await import('@/lib/plan-state');
  const { itinerary } = await import('@/data/itinerary');
  it('sustituye el Aventino del sábado por la alternativa bajo techo y se puede deshacer', () => {
    const wet = applyRain(itinerary, new Set([2]));
    expect(wet.some((s) => s.id === 'd2-aventino')).toBe(false);
    expect(wet.some((s) => s.id === 'r2-capitolini')).toBe(true);
    expect(applyRain(itinerary, new Set()).some((s) => s.id === 'd2-aventino')).toBe(true);
  });
  it('no toca otros días', () => {
    const wet = applyRain(itinerary, new Set([2]));
    expect(wet.filter((s) => s.day === 3)).toEqual(itinerary.filter((s) => s.day === 3));
  });
});

describe('tiempo (Open-Meteo)', async () => {
  const { parseForecast, weatherText, isRainy, ageText } = await import('@/lib/weather');
  it('lee la previsión diaria', () => {
    const f = parseForecast({ daily: { time: ['2026-10-31'], weather_code: [61], temperature_2m_max: [19.6], temperature_2m_min: [11.2], precipitation_probability_max: [80] } }, 0);
    expect(f?.days[0]).toEqual({ date: '2026-10-31', code: 61, tmax: 20, tmin: 11, rainProb: 80 });
    expect(weatherText(61)).toBe('Lluvia');
    expect(isRainy(1, 70)).toBe(true);
  });
  it('sin conexión dice cuándo se actualizó', () => {
    expect(ageText(0, 5 * 3600_000)).toBe('actualizado hace 5 h');
  });
});
