// Navegación a pie: instrucciones en español a partir de OSRM, avance de pasos y detección de desvío.
import { distanceM, type LatLng } from '@/lib/geo';

export interface Step { text: string; type: string; at: [number, number]; distanceM: number }

interface OsrmManeuver { type?: string; modifier?: string; location: [number, number]; exit?: number }
export interface OsrmStep { distance: number; name?: string; maneuver: OsrmManeuver }

const SIDE: Record<string, string> = {
  left: 'a la izquierda', right: 'a la derecha', 'slight left': 'ligeramente a la izquierda', 'slight right': 'ligeramente a la derecha',
  'sharp left': 'cerrado a la izquierda', 'sharp right': 'cerrado a la derecha',
};

export function instruction(m: OsrmManeuver, name?: string): string {
  const via = name ? ` por ${name}` : '';
  const mod = m.modifier ?? '';
  switch (m.type) {
    case 'depart': return name ? `Empieza por ${name}` : 'Empieza a andar';
    case 'arrive': return mod === 'left' ? 'Has llegado: el destino queda a tu izquierda' : mod === 'right' ? 'Has llegado: el destino queda a tu derecha' : 'Has llegado';
    case 'turn': return mod === 'straight' ? `Sigue recto${via}` : mod === 'uturn' ? 'Da la vuelta' : `Gira ${SIDE[mod] ?? 'aquí'}${via}`;
    case 'end of road': return `Al final de la calle, gira ${SIDE[mod] ?? 'aquí'}${via}`;
    case 'fork': return `Toma la bifurcación ${mod.includes('left') ? 'de la izquierda' : mod.includes('right') ? 'de la derecha' : 'de frente'}${via}`;
    case 'roundabout': case 'rotary': case 'roundabout turn': return m.exit ? `En la rotonda, toma la salida ${m.exit}${via}` : `Cruza la rotonda${via}`;
    case 'new name': case 'continue': return mod && mod !== 'straight' ? `Sigue ${SIDE[mod] ?? ''}${via}`.replace('  ', ' ') : `Sigue recto${via}`;
    default: return name ? `Continúa por ${name}` : 'Continúa';
  }
}

/** Aplana los pasos de todos los tramos. Cada Step es una maniobra y los metros que quedan hasta la siguiente. */
export function parseSteps(legs: { steps?: OsrmStep[] }[] | undefined): Step[] {
  const out: Step[] = [];
  for (const leg of legs ?? []) {
    for (const s of leg.steps ?? []) {
      out.push({ text: instruction(s.maneuver, s.name), type: s.maneuver.type ?? '', at: s.maneuver.location, distanceM: s.distance });
    }
  }
  return out;
}

const at = (s: Step): LatLng => ({ lng: s.at[0], lat: s.at[1] });

/** Distancia (m) de un punto a la línea de la ruta. Proyección plana, suficiente a escala de ciudad. */
export function distToLineM(p: LatLng, coords: [number, number][]): number {
  if (!coords.length) return Infinity;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const M = 111_195;
  const px = p.lng * k * M, py = p.lat * M;
  let best = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const [ax0, ay0] = coords[i]!;
    const [bx0, by0] = coords[Math.min(i + 1, coords.length - 1)]!;
    const ax = ax0 * k * M, ay = ay0 * M, bx = bx0 * k * M, by = by0 * M;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export const REACHED_M = 22;
export const OFF_ROUTE_M = 55;
export const ARRIVED_M = 25;

/** Siguiente maniobra por hacer: salta las que ya has pasado (a menos de REACHED_M). El paso 0 es la salida. */
export function advance(me: LatLng, steps: Step[], current: number): number {
  let next = Math.max(1, current);
  for (let j = next; j < steps.length - 1; j++) if (distanceM(me, at(steps[j]!)) < REACHED_M) next = j + 1;
  return Math.min(next, steps.length - 1);
}

export function distanceToStep(me: LatLng, s: Step): number {
  return distanceM(me, at(s));
}

export function isOffRoute(me: LatLng, coords: [number, number][]): boolean {
  return distToLineM(me, coords) > OFF_ROUTE_M;
}

/** Rumbo (0–360°) de a hacia b. */
export function bearing(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Lo que dice la voz: «Dentro de 80 metros, gira a la izquierda por Via del Corso». */
export function spoken(steps: Step[], i: number): string {
  const s = steps[i];
  if (!s) return '';
  if (s.type === 'arrive') return s.text;
  const d = steps[i - 1]?.distanceM ?? 0;
  if (d < 30) return s.text;
  const metros = d >= 1000 ? `${(d / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kilómetros` : `${Math.round(d / 10) * 10} metros`;
  return `Dentro de ${metros}, ${s.text.charAt(0).toLowerCase()}${s.text.slice(1)}`;
}

/** Metros que faltan hasta el final: lo que queda hasta la próxima maniobra más los tramos siguientes. */
export function remainingM(me: LatLng, steps: Step[], i: number): number {
  const s = steps[i];
  if (!s) return 0;
  let rest = distanceM(me, at(s));
  for (let j = i; j < steps.length; j++) rest += steps[j]!.distanceM;
  return rest;
}
