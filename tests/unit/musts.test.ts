import { describe, expect, it } from 'vitest';
import { musts, mustsFor } from '@/data/musts';
import { itinerary } from '@/data/itinerary';

describe('imprescindible', () => {
  it('ids únicos y días del viaje', () => {
    expect(new Set(musts.map((m) => m.id)).size).toBe(musts.length);
    for (const m of musts) if (m.day) expect([1, 2, 3, 4, 5]).toContain(m.day);
  });
  it('el check-out del lunes coincide con la parada del plan', () => {
    const stop = itinerary.find((s) => s.id === 'd4-checkout');
    const must = mustsFor(4).find((m) => m.id === 'checkout');
    expect(stop?.start).toBe(must?.time);
  });
});
