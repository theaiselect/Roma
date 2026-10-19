import { describe, expect, it } from 'vitest';
import { itinerary } from '@/data/itinerary';
import { placeById, places } from '@/data/places';
import { monuments } from '@/data/monuments';
import { reservations } from '@/data/reservations';

describe('integridad del contenido', () => {
  it('los ids de sitios son únicos', () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });

  it('cada parada y cada plan B apunta a un sitio que existe', () => {
    for (const s of itinerary) {
      if (s.placeId) expect(placeById.has(s.placeId), s.id).toBe(true);
      for (const b of s.planB ?? []) expect(placeById.has(b.placeId), `${s.id} → ${b.placeId}`).toBe(true);
    }
  });

  it('cada entrada referida por una parada existe en reservas', () => {
    const ids = new Set(reservations.map((r) => r.id));
    for (const s of itinerary) if (s.ticketId) expect(ids.has(s.ticketId), s.id).toBe(true);
  });

  it('las coordenadas caen en Roma centro (o faltan)', () => {
    for (const p of places) {
      if (p.lat === undefined) continue;
      expect(p.lat, p.id).toBeGreaterThan(41.86);
      expect(p.lat, p.id).toBeLessThan(41.93);
      expect(p.lng, p.id).toBeGreaterThan(12.43);
      expect(p.lng, p.id).toBeLessThan(12.53);
    }
  });

  it('los cierres del documento están cargados', () => {
    expect(placeById.get('da-enzo')?.hours?.sun).toBeNull();
    expect(placeById.get('boccione')?.hours?.sat).toBeNull();
    expect(placeById.get('two-sizes')?.hours?.mon).toBeNull();
    expect(placeById.get('ai-marmi')?.hours?.wed).toBeNull();
  });

  it('los 5 días tienen paradas', () => {
    for (const d of [1, 2, 3, 4, 5]) expect(itinerary.some((s) => s.day === d)).toBe(true);
  });

  it('monumentos con ids únicos y marcas leídas', () => {
    expect(new Set(monuments.map((m) => m.id)).size).toBe(monuments.length);
    expect(monuments.find((m) => m.name === 'Coliseo')?.flag).toBe('see');
    expect(monuments.find((m) => m.name === 'Galleria Borghese')?.flag).toBe('ticket');
  });
});
