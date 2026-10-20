import { useEffect, useState } from 'preact/hooks';

// Datos que solo viven en este móvil (localStorage). Nunca se sincronizan.
const EVENT = 'roma-local-change';

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}

export function writeLocal<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento: se queda en memoria de la pantalla */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => readLocal(key, fallback));
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail === key) setV(readLocal(key, fallback)); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [v, (x) => { setV(x); writeLocal(key, x); }];
}
