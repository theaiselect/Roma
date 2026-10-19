import { afterEach, describe, expect, it } from 'vitest';
import { checkTripCode, hashTripCode } from '../../api/_auth';

const req = (code?: string) => new Request('https://x/api/sync', { headers: code ? { 'x-trip-code': code } : {} });

describe('código del viaje', () => {
  afterEach(() => { delete process.env.TRIP_CODE_HASH; });

  it('sin TRIP_CODE_HASH responde 503', () => {
    expect(checkTripCode(req('lo-que-sea'))?.status).toBe(503);
  });

  it('acepta el código correcto (ignorando espacios) y rechaza el resto', () => {
    process.env.TRIP_CODE_HASH = hashTripCode('gelato-trevi-luna');
    expect(checkTripCode(req('gelato-trevi-luna'))).toBeNull();
    expect(checkTripCode(req('  gelato-trevi-luna '))).toBeNull();
    expect(checkTripCode(req('otro'))?.status).toBe(401);
    expect(checkTripCode(req())?.status).toBe(401);
  });
});
