import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { darkColor, darkenBasemap, localizeLabels, luminance, mapColors, parseColor } from '../../src/lib/map-theme';
const require = createRequire(import.meta.url);

describe('mapa nocturno', () => {
  it('lee hex, rgb y hsl', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#17110f80')?.[3]).toBeCloseTo(0.5, 1);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('hsl(0, 0%, 100%)')).toEqual([255, 255, 255, 1]);
    expect(parseColor('hsla(120, 100%, 50%, 0.5)')).toEqual([0, 255, 0, 0.5]);
    expect(parseColor('interpolate')).toBeNull();
  });

  it('el fondo claro pasa a oscuro y el texto oscuro a claro', () => {
    const bg = parseColor(darkColor('background', 'background-color', 'hsl(0,0%,95%)'))!;
    expect(bg[0]).toBeLessThan(40);
    const text = parseColor(darkColor('place_label', 'text-color', '#333'))!;
    expect(text[0]).toBeGreaterThan(150);
    const halo = parseColor(darkColor('place_label', 'text-halo-color', '#fff'))!;
    expect(halo[0]).toBeLessThan(40);
  });

  it('las calles blancas quedan más claras que el fondo y su borde más oscuro', () => {
    const body = parseColor(darkColor('road_minor', 'line-color', '#ffffff'))!;
    const casing = parseColor(darkColor('road_minor_casing', 'line-color', '#cfcdca'))!;
    expect(body[0]).toBeGreaterThan(casing[0]);
    expect(body[0]).toBeGreaterThan(23);
  });

  it('recolorea expresiones sin tocar lo que no es color', () => {
    const v = ['interpolate', ['linear'], ['zoom'], 10, '#ffffff', 16, 'hsl(0,0%,80%)'];
    const r = mapColors(v, () => 'X') as unknown[];
    expect(r.slice(0, 5)).toEqual(['interpolate', ['linear'], ['zoom'], 10, 'X']);
    expect(r[6]).toBe('X');
  });

  it('darkenBasemap cambia las capas de color y aguanta capas raras', () => {
    const calls: [string, string, unknown][] = [];
    darkenBasemap({
      getStyle: () => ({ layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#eee' } },
        { id: 'water', type: 'fill', paint: { 'fill-color': 'hsl(210,20%,80%)' } },
        { id: 'raster', type: 'raster', paint: {} },
      ] }),
      setPaintProperty: (l, p, v) => { calls.push([l, p, v]); },
    });
    expect(calls.map((c) => c[0])).toEqual(['background', 'water']);
    expect(String(calls[1]![2])).toMatch(/^rgba\(/);
  });
});

describe('mapa nocturno con el estilo real de OpenFreeMap (positron)', () => {
  const style = JSON.parse(require('node:fs').readFileSync(new URL('../fixtures/ofm-positron-style.json', import.meta.url), 'utf8')) as { layers: { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }[] };
  const painted = new Map<string, unknown>();
  darkenBasemap({ getStyle: () => style, setPaintProperty: (l, p, v) => { painted.set(`${l}|${p}`, v); } });
  const first = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? first(v.find((x) => typeof x === 'string' && parseColor(x)) ?? v.find(Array.isArray)) : '');
  const bg = luminance(first(painted.get('background|background-color')));

  it('todas las calzadas quedan más claras que el fondo (las pequeñas también)', () => {
    const roads = style.layers.filter((l) => l.type === 'line' && /^(highway|tunnel|bridge|road)/.test(l.id) && !/casing|subtle/.test(l.id));
    expect(roads.map((l) => l.id)).toContain('highway_minor');
    for (const l of roads) {
      const v = painted.get(`${l.id}|line-color`);
      const vals = Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string' && !!parseColor(x)) : [v as string];
      const last = vals[vals.length - 1]!;
      expect(luminance(last), l.id).toBeGreaterThan(bg + 0.05);
    }
  });

  it('los bordes de las calles son más oscuros que la calzada', () => {
    expect(luminance(first(painted.get('highway_major_casing|line-color')))).toBeLessThan(luminance(first(painted.get('highway_major_inner|line-color'))));
  });

  it('los rótulos dejan de salir en inglés: calles con su nombre local y sitios en español', () => {
    const fields = new Map<string, unknown>();
    localizeLabels({ getStyle: () => style, setLayoutProperty: (l, _p, v) => { fields.set(l, v); } });
    const all = JSON.stringify([...fields.values()]);
    expect(all).not.toContain('name_en');
    expect(JSON.stringify(fields.get('highway-name-minor'))).toContain('"name"');
    expect(JSON.stringify(fields.get('label_city'))).toContain('name:es');
  });
});
