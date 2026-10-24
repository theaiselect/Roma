// Descarga sin conexión más rápida: espejos de Overpass a la vez, paquete ya preparado y progreso total.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGraph, packGraph, routeLeg, unpackGraph, type RawWay } from '@/lib/graph';
import { mirrorOrder, overpassRace, packUsable, PACK_MAX_AGE, pool } from '@/lib/offline-data';
import { activeStages, overallPct } from '@/lib/auto-offline';

const A = 'https://a/api/interpreter', B = 'https://b/api/interpreter', C = 'https://c/api/interpreter';
const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });

/** fetch falso: cada espejo responde tras `ms` con su respuesta; anota a quién se preguntó y quién se canceló. */
function fakeFetch(plan: Record<string, { ms: number; res: () => Response }>) {
  const asked: string[] = [], aborted: string[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    asked.push(url);
    const p = plan[url]!;
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(p.res()), p.ms);
      init.signal?.addEventListener('abort', () => { clearTimeout(t); aborted.push(url); reject(new DOMException('abort', 'AbortError')); });
    });
  });
  return { asked, aborted };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('espejos de Overpass', () => {
  it('prueba primero el que funcionó la última vez', () => {
    expect(mirrorOrder(B, [A, B, C])).toEqual([B, A, C]);
    expect(mirrorOrder(null, [A, B, C])).toEqual([A, B, C]);
    expect(mirrorOrder('https://otro', [A, B, C])).toEqual([A, B, C]);
  });

  it('si el primero tarda, pregunta también al siguiente y gana el más rápido', async () => {
    vi.useFakeTimers();
    const f = fakeFetch({ [A]: { ms: 60_000, res: () => ok({ elements: ['a'] }) }, [B]: { ms: 2_000, res: () => ok({ elements: ['b'] }) }, [C]: { ms: 1, res: () => ok({}) } });
    const p = overpassRace<{ elements: string[] }>('q', [A, B, C], 90_000, 10_000);
    await vi.advanceTimersByTimeAsync(12_500);
    const r = await p;
    expect(r.url).toBe(B);
    expect(r.data.elements).toEqual(['b']);
    expect(f.asked).toEqual([A, B]); // el tercero no hizo falta
    expect(f.aborted).toContain(A); // y el lento se cancela
  });

  it('un error pasa al siguiente al momento, sin esperar', async () => {
    vi.useFakeTimers();
    const f = fakeFetch({ [A]: { ms: 100, res: () => new Response('busy', { status: 429 }) }, [B]: { ms: 100, res: () => ok({ elements: [1] }) }, [C]: { ms: 1, res: () => ok({}) } });
    const p = overpassRace('q', [A, B, C], 90_000, 10_000);
    await vi.advanceTimersByTimeAsync(300);
    expect((await p).url).toBe(B);
    expect(f.asked).toEqual([A, B]);
  });

  it('una respuesta a medias («runtime error») no vale', async () => {
    vi.useFakeTimers();
    fakeFetch({ [A]: { ms: 10, res: () => ok({ elements: [], remark: 'runtime error: Query timed out' }) }, [B]: { ms: 10, res: () => ok({ elements: [2] }) } });
    const p = overpassRace('q', [A, B], 90_000, 10_000);
    await vi.advanceTimersByTimeAsync(100);
    expect((await p).url).toBe(B);
  });

  it('si fallan todos, falla', async () => {
    vi.useFakeTimers();
    fakeFetch({ [A]: { ms: 10, res: () => new Response('', { status: 502 }) }, [B]: { ms: 10, res: () => new Response('', { status: 504 }) } });
    const p = overpassRace('q', [A, B], 90_000, 10_000);
    const done = expect(p).rejects.toThrow('overpass 504');
    await vi.advanceTimersByTimeAsync(100);
    await done;
  });

  it('pool: no pasa de n a la vez y conserva el orden', async () => {
    let now = 0, max = 0;
    const r = await pool([1, 2, 3, 4, 5], 2, async (x) => { now++; max = Math.max(max, now); await new Promise((s) => setTimeout(s, 5)); now--; return x * 10; });
    expect(r).toEqual([10, 20, 30, 40, 50]);
    expect(max).toBe(2);
  });
});

describe('paquete ya preparado', () => {
  const ways: RawWay[] = [
    { hw: 'residential', name: 'Via A', pts: [[41.9, 12.49], [41.9, 12.491], [41.9, 12.492]] },
    { hw: 'steps', name: 'Scalinata', pts: [[41.9, 12.491], [41.901, 12.491]] },
  ];
  it('el grafo vuelve igual del JSON y sirve para rutas', () => {
    const g = buildGraph(ways);
    const back = unpackGraph(JSON.parse(JSON.stringify(packGraph(g))));
    expect(back.n).toBe(g.n);
    expect(Array.from(back.to)).toEqual(Array.from(g.to));
    expect(back.names).toEqual(g.names);
    const a = routeLeg(g, { lat: 41.9, lng: 12.49 }, { lat: 41.901, lng: 12.491 })!;
    const b = routeLeg(back, { lat: 41.9, lng: 12.49 }, { lat: 41.901, lng: 12.491 })!;
    expect(Math.abs(a.distanceM - b.distanceM)).toBeLessThanOrEqual(1);
  });
  it('solo se usa si es de la versión buena y no es muy viejo', () => {
    const now = 1_800_000_000_000;
    expect(packUsable({ v: 1, at: now - 1000, graphV: 2 }, now)).toBe(true);
    expect(packUsable({ v: 1, at: now - PACK_MAX_AGE - 1, graphV: 2 }, now)).toBe(false);
    expect(packUsable({ v: 2, at: now }, now)).toBe(false);
    expect(packUsable(null, now)).toBe(false);
    expect(packUsable('<html>', now)).toBe(false);
  });
});

describe('progreso total (etapas a la vez)', () => {
  it('cuenta cada etapa por igual y una terminada entera', () => {
    expect(overallPct({ need: ['map', 'graph'], progress: { map: { done: 50, total: 100 }, graph: { done: 1, total: 1, end: 'ok' } } })).toBe(75);
    expect(overallPct({ need: ['map'], progress: {} })).toBe(0);
    expect(overallPct({ need: ['map'], progress: { map: { done: 100, total: 100 } } })).toBe(99); // 100 % solo al terminar
    expect(activeStages({ need: ['map', 'graph', 'pois'], progress: { graph: { done: 1, total: 1, end: 'ok' } } })).toEqual(['map', 'pois']);
  });
});

describe('calles con puntos vacíos', () => {
  it('parte la calle en los tramos con puntos en vez de romperse', async () => {
    const { parseWays } = await import('@/lib/offline-data');
    const ways = parseWays({ elements: [
      { type: 'way', tags: { highway: 'residential', name: 'Via X' }, geometry: [{ lat: 1, lon: 1 }, { lat: 1, lon: 2 }, null, { lat: 1, lon: 3 }, { lat: 1, lon: 4 }, { lat: 1, lon: 5 }] },
      { type: 'way', tags: { highway: 'footway' }, geometry: [null, { lat: 2, lon: 1 }, null] },
    ] });
    expect(ways.map((w) => w.pts.length)).toEqual([2, 3]);
    expect(ways[0]!.name).toBe('Via X');
  });
});

describe('islas de calles', () => {
  it('la ruta sale de la calle conectada aunque haya una isla más cerca', async () => {
    const { buildGraph: bg, routeLeg: rl } = await import('@/lib/graph');
    const S = 0.001, w: RawWay[] = [];
    for (let i = 0; i < 8; i++) {
      w.push({ hw: 'residential', name: `E${i}`, pts: Array.from({ length: 8 }, (_, j) => [41.9 + i * S, 12.49 + j * S] as [number, number]) });
      w.push({ hw: 'residential', name: `N${i}`, pts: Array.from({ length: 8 }, (_, j) => [41.9 + j * S, 12.49 + i * S] as [number, number]) });
    }
    // isla: un trozo de acera suelto justo al lado del destino
    w.push({ hw: 'footway', pts: [[41.9105, 12.4955], [41.9105, 12.4956]] });
    const r = rl(bg(w), { lat: 41.9, lng: 12.49 }, { lat: 41.91051, lng: 12.49555 });
    expect(r).not.toBeNull();
    expect(r!.distanceM).toBeGreaterThan(1000);
  });
});
