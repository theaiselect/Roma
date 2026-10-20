import { useEffect, useState } from 'preact/hooks';
import { getMeta, setMeta } from '@/lib/db';

// Datos privados (reserva del hotel…): no van dentro de la app, que es pública para quien tenga el enlace.
// Llegan del servidor solo con el código del viaje y se guardan en el móvil para verlos sin conexión.
export interface PrivateData { hotel?: { bookingSite?: string; bookingRef?: string; pin?: string } }
interface Stored { at: number; data: PrivateData }

const KEY = 'private-data';
const EVENT = 'roma-private-change';
const EVERY = 3600_000;

export async function refreshPrivate(h: Record<string, string>, force = false): Promise<void> {
  const cur = await getMeta<Stored>(KEY);
  if (!force && cur && Date.now() - cur.at < EVERY) return;
  const res = await fetch('/api/private', { headers: h });
  if (!res.ok) return;
  await setMeta(KEY, { at: Date.now(), data: (await res.json()) as PrivateData } satisfies Stored);
  window.dispatchEvent(new Event(EVENT));
}

export function usePrivate(): PrivateData | null {
  const [d, setD] = useState<PrivateData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => { void getMeta<Stored>(KEY).then((s) => { if (alive) setD(s?.data ?? null); }); };
    load();
    window.addEventListener(EVENT, load);
    return () => { alive = false; window.removeEventListener(EVENT, load); };
  }, []);
  return d;
}
