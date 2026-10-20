// Mapa oscuro «Notte romana»: se reutiliza el estilo claro de OpenFreeMap (ya guardado sin conexión)
// y se recolorean sus capas al cargar. Así no hay otro estilo que descargar ni que cachear.

type RGBA = [number, number, number, number];

export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) return [+m[1]!, +m[2]!, +m[3]!, alpha(m[4])];
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const h = ((+m[1]! % 360) + 360) % 360 / 360, sat = +m[2]! / 100, l = +m[3]! / 100;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const f = (t: number) => {
      const x = (t + 1) % 1;
      const v = x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
      return Math.round(v * 255);
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3), alpha(m[4])];
  }
  return null;
}

function alpha(v?: string): number {
  if (v === undefined) return 1;
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
}

const lum = (c: RGBA) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const out = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(3)})`;

const BG: RGB = [23, 17, 15];
const LAND_HI: RGB = [44, 33, 28];
const WATER: RGB = [16, 27, 34];
const GREEN: RGB = [27, 27, 19];
const BUILDING: RGB = [38, 29, 25];
const ROAD: RGB = [78, 61, 52];
const ROAD_CASING: RGB = [12, 9, 8];
const LINE_HI: RGB = [90, 67, 56];
const TEXT_LO: RGB = [143, 127, 115];
const TEXT_HI: RGB = [232, 220, 205];

const isWater = (id: string) => /water|sea|ocean|river|lake/.test(id);
const isGreen = (id: string) => /park|wood|grass|forest|green|garden|pitch|landcover|meadow|scrub|cemetery/.test(id);
const isRoad = (id: string) => /road|street|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|minor|service|path|pedestrian|highway|link/.test(id);

/** Color de la capa `id`, propiedad `prop`, en su versión nocturna. */
export function darkColor(id: string, prop: string, input: string): string {
  const c = parseColor(input);
  if (!c) return input;
  const L = lum(c);
  const a = c[3];
  switch (prop) {
    case 'background-color': return out(BG, a);
    case 'fill-color':
      if (isWater(id)) return out(WATER, a);
      if (isGreen(id)) return out(GREEN, a);
      if (/building/.test(id)) return out(BUILDING, a);
      return out(mix(BG, LAND_HI, clamp((1 - L) * 4)), a);
    case 'fill-outline-color': return out(mix(BG, LINE_HI, 0.5), a);
    case 'fill-extrusion-color': return out(BUILDING, a);
    case 'line-color':
      if (isWater(id)) return out(mix(WATER, [40, 66, 80], 0.6), a);
      if (isRoad(id)) return out(L >= 0.9 ? ROAD : ROAD_CASING, a);
      return out(mix(BG, LINE_HI, clamp((1 - L) * 1.3)), a);
    case 'text-color': case 'icon-color': return out(mix(TEXT_LO, TEXT_HI, clamp((1 - L) * 1.4)), a);
    case 'text-halo-color': case 'icon-halo-color': return out(BG, Math.max(a, 0.85));
    default: return input;
  }
}

const COLOR_PROPS: Record<string, string[]> = {
  background: ['background-color'],
  fill: ['fill-color', 'fill-outline-color'],
  line: ['line-color'],
  symbol: ['text-color', 'text-halo-color', 'icon-color', 'icon-halo-color'],
  'fill-extrusion': ['fill-extrusion-color'],
};

/** Aplica `fn` a cada texto que sea un color dentro de un valor (que puede ser una expresión de MapLibre). */
export function mapColors(v: unknown, fn: (c: string) => string): unknown {
  if (typeof v === 'string') return parseColor(v) ? fn(v) : v;
  if (Array.isArray(v)) return v.map((x) => mapColors(x, fn));
  if (v && typeof v === 'object' && Array.isArray((v as { stops?: unknown }).stops)) {
    const o = v as { stops: [unknown, unknown][] };
    return { ...o, stops: o.stops.map(([z, c]) => [z, mapColors(c, fn)]) };
  }
  return v;
}

interface StyleLayer { id: string; type: string; paint?: Record<string, unknown> }
interface MapLike {
  getStyle(): { layers?: StyleLayer[] } | undefined;
  setPaintProperty(layer: string, prop: string, value: unknown): void;
}

/** Recolorea el mapa base (no toca las capas de la app, que se añaden después). */
export function darkenBasemap(map: MapLike): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const l of layers) {
    for (const prop of COLOR_PROPS[l.type] ?? []) {
      const v = l.paint?.[prop];
      if (v === undefined) continue;
      try { map.setPaintProperty(l.id, prop, mapColors(v, (c) => darkColor(l.id, prop, c))); } catch { /* capa rara: se queda como está */ }
    }
  }
}
