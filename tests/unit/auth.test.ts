import { afterEach, describe, expect, it } from 'vitest';
import { checkTripCode, hashTripCode } from '../../api/_auth';
import { MemoryStore } from '../../api/_core';

const req = (code?: string, ip = '1.2.3.4') => new Request('https://x/api/sync', { headers: { ...(code ? { 'x-trip-code': code } : {}), 'x-forwarded-for': ip } });

describe('código del viaje', () => {
  afterEach(() => { delete process.env.TRIP_CODE_HASH; delete process.env.TRIP_CODE; });

  it('sin configurar responde 503', async () => {
    expect((await checkTripCode(req('lo-que-sea')))?.status).toBe(503);
  });

  it('acepta el código correcto (ignorando espacios) y rechaza el resto', async () => {
    process.env.TRIP_CODE_HASH = hashTripCode('gelato-trevi-luna');
    expect(await checkTripCode(req('gelato-trevi-luna'))).toBeNull();
    expect(await checkTripCode(req('  gelato-trevi-luna '))).toBeNull();
    expect((await checkTripCode(req('otro')))?.status).toBe(401);
    expect((await checkTripCode(req()))?.status).toBe(401);
  });

  it('también vale TRIP_CODE en claro (solo servidor)', async () => {
    process.env.TRIP_CODE = 'gelato-trevi-luna';
    expect(await checkTripCode(req('gelato-trevi-luna'))).toBeNull();
    expect((await checkTripCode(req('nope')))?.status).toBe(401);
  });

  it('tras 10 fallos en un minuto bloquea la IP', async () => {
    process.env.TRIP_CODE = 'gelato-trevi-luna';
    const store = new MemoryStore();
    for (let i = 0; i < 11; i++) await checkTripCode(req('mal', '9.9.9.9'), store);
    expect((await checkTripCode(req('gelato-trevi-luna', '9.9.9.9'), store))?.status).toBe(429);
    expect(await checkTripCode(req('gelato-trevi-luna', '8.8.8.8'), store)).toBeNull();
  });
});
