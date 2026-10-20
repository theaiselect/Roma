import { describe, expect, it } from 'vitest';
import { darkColor, darkenBasemap, mapColors, parseColor } from '../../src/lib/map-theme';

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
