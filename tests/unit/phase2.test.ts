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

describe('mapa sin conexión: teselas y datos libres', async () => {
  const { tilesForBbox, lngToX, latToY, tileUrl, estimateMB, extraUrls, fontStacks } = await import('@/lib/offline-map');
  const { parseOsrm, parsePhoton, parseOverpass, overpassQuery, formatDuration } = await import('@/lib/osm');
  it('coordenadas a tesela: el Coliseo en el zoom 14', () => {
    expect(lngToX(12.4924, 14)).toBe(8_760);
    expect(latToY(41.8902, 14)).toBe(6_088);
  });
  it('cubre el rectángulo y crece con el zoom', () => {
    const b = { west: 12.4, south: 41.84, east: 12.57, north: 41.95 };
    const z12 = tilesForBbox(b, 12, 12).length, z14 = tilesForBbox(b, 14, 14).length;
    expect(z12).toBeGreaterThan(0);
    expect(z14).toBeGreaterThan(z12);
    expect(tilesForBbox(b, 0, 0)).toEqual([{ z: 0, x: 0, y: 0 }]);
    expect(estimateMB()).toBeGreaterThan(5);
  });
  it('plantilla de teselas', () => {
    expect(tileUrl('https://x/planet/v1/{z}/{x}/{y}.pbf', { z: 14, x: 8760, y: 6088 })).toBe('https://x/planet/v1/14/8760/6088.pbf');
  });
  it('letras e iconos del estilo', () => {
    const style = { glyphs: 'https://t/fonts/{fontstack}/{range}.pbf', sprite: 'https://t/sprites/a/ofm', sources: {}, layers: [{ layout: { 'text-font': ['Noto Sans Regular'] } }, { layout: { 'text-font': ['Noto Sans Regular'] } }, { layout: { 'text-font': ['Noto Sans Bold', 'Noto Sans Regular'] } }, {}] };
    expect(fontStacks(style)).toEqual(['Noto Sans Regular', 'Noto Sans Bold,Noto Sans Regular']);
    expect(extraUrls(style)).toContain('https://t/fonts/Noto Sans Regular/0-255.pbf');
    expect(extraUrls(style)).toContain('https://t/sprites/a/ofm@2x.png');
  });
  it('lee la ruta de OSRM, el buscador Photon y los puntos de Overpass', () => {
    expect(parseOsrm({ code: 'Ok', routes: [{ distance: 1234, duration: 900, geometry: { coordinates: [[1, 2]] } }] })).toEqual({ distanceM: 1234, durationS: 900, coords: [[1, 2]] });
    expect(parseOsrm({ code: 'NoRoute' })).toBeNull();
    expect(parsePhoton({ features: [{ geometry: { coordinates: [12.47, 41.89] }, properties: { name: 'Pantheon', street: 'Piazza della Rotonda', city: 'Roma' } }, { geometry: { coordinates: [0, 0] }, properties: {} }] })).toMatchObject([{ name: 'Pantheon', lat: 41.89, lng: 12.47 }]);
    const pois = parseOverpass({ elements: [
      { type: 'node', id: 1, lat: 41.9, lon: 12.48, tags: { amenity: 'drinking_water' } },
      { type: 'way', id: 2, center: { lat: 41.91, lon: 12.49 }, tags: { amenity: 'toilets', fee: 'yes' } },
      { type: 'node', id: 3, lat: 41.9, lon: 12.5, tags: { amenity: 'bench' } },
    ] });
    expect(pois.map((p) => [p.id, p.kind, p.note])).toEqual([['n1', 'fountain', undefined], ['w2', 'toilets', 'De pago']]);
    expect(overpassQuery()).toContain('amenity=drinking_water');
    expect(formatDuration(900)).toBe('15 min');
    expect(formatDuration(4000)).toBe('1 h 7 min');
  });
});
