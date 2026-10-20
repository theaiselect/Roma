import { describe, expect, it } from 'vitest';
import { agoText, failing, readinessChecks, type ReadyInput } from '../../src/lib/readiness';

const now = Date.UTC(2026, 9, 28, 12);
const ok = (): ReadyInput => ({
  now, installed: true, hasCode: true, server: { ok: true, text: '' }, pending: 0, lastSyncAt: now - 60_000,
  partner: { name: 'Lucía', seenAt: now - 3600_000 }, swReady: true, persisted: true, missing: [],
});

describe('¿Está todo listo?', () => {
  it('todo en orden: ninguna comprobación crítica falla', () => {
    expect(failing(readinessChecks(ok()))).toEqual([]);
  });

  it('detecta cada cosa que falta', () => {
    const c = (patch: Partial<ReadyInput>) => failing(readinessChecks({ ...ok(), ...patch })).map((x) => x.id);
    expect(c({ installed: false })).toEqual(['install']);
    expect(c({ hasCode: false })).toContain('code');
    expect(c({ server: { ok: false, text: 'mal' } })).toEqual(['code']);
    expect(c({ pending: 3 })).toEqual(['sync']);
    expect(c({ lastSyncAt: null })).toEqual(['sync']);
    expect(c({ lastSyncAt: now - 30 * 3600_000 })).toEqual(['sync']);
    expect(c({ partner: { name: 'Lucía', seenAt: null } })).toEqual(['partner']);
    expect(c({ partner: { name: 'Lucía', seenAt: now - 8 * 24 * 3600_000 } })).toEqual(['partner']);
    expect(c({ swReady: false })).toEqual(['shell']);
    expect(c({ missing: ['map', 'metro'] })).toEqual(['offline']);
  });

  it('el almacenamiento sin proteger avisa pero no es crítico', () => {
    const all = readinessChecks({ ...ok(), persisted: false });
    expect(all.find((x) => x.id === 'persist')?.ok).toBe(false);
    expect(failing(all)).toEqual([]);
  });

  it('dice qué falta de descargar y a quién se espera', () => {
    const all = readinessChecks({ ...ok(), missing: ['map', 'metro'], partner: { name: 'Jesús', seenAt: null } });
    expect(all.find((x) => x.id === 'offline')?.detail).toMatch(/mapa de roma, metro/);
    expect(all.find((x) => x.id === 'partner')?.title).toBe('Jesús en su móvil');
  });

  it('tiempos legibles', () => {
    expect(agoText(30_000)).toBe('hace un momento');
    expect(agoText(25 * 60_000)).toBe('hace 25 min');
    expect(agoText(3 * 3600_000)).toBe('hace 3 h');
    expect(agoText(24 * 3600_000)).toBe('hace 1 día');
    expect(agoText(3 * 24 * 3600_000)).toBe('hace 3 días');
  });
});
