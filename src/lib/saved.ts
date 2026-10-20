import { save, useKind, type Entity } from '@/lib/db';
import { distanceM, type LatLng } from '@/lib/geo';

// Sitios guardados con ⭐: se sincronizan con la pareja y viven en el móvil (funcionan sin conexión).
export interface SavedEntity extends Entity { kind: 'saved'; name: string; detail?: string; lat: number; lng: number; placeId?: string }

export interface SavedInput { name: string; detail?: string; lat: number; lng: number; placeId?: string }

/** Un sitio del plan se guarda por su id; cualquier otro punto, por sus coordenadas (≈ 10 m). */
export function savedId(p: { placeId?: string; lat: number; lng: number }): string {
  return p.placeId ? `saved:${p.placeId}` : `saved:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

export function useSaved(): SavedEntity[] {
  return ((useKind<SavedEntity>('saved') ?? []).filter((s) => !s.deleted && typeof s.lat === 'number')).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function findSaved(list: SavedEntity[], p: { placeId?: string; lat: number; lng: number }): SavedEntity | undefined {
  const id = savedId(p);
  return list.find((s) => s.id === id) ?? list.find((s) => !p.placeId && distanceM(s, p) < 15);
}

/** Pone o quita la estrella. Devuelve true si ha quedado guardado. */
export async function toggleSaved(list: SavedEntity[], p: SavedInput): Promise<boolean> {
  const cur = findSaved(list, p);
  if (cur) { await save({ ...cur, deleted: true }); return false; }
  await save({ id: savedId(p), kind: 'saved', name: p.name, detail: p.detail, lat: p.lat, lng: p.lng, placeId: p.placeId, deleted: false });
  return true;
}

export function nearestSaved(list: SavedEntity[], from: LatLng, limit = 20): { s: SavedEntity; d: number }[] {
  return list.map((s) => ({ s, d: distanceM(from, s) })).sort((a, b) => a.d - b.d).slice(0, limit);
}
