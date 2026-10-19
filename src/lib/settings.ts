import { useEffect, useState } from 'preact/hooks';
import type { Who } from '@/data/types';

// Ajustes locales (localStorage): perfil, tema, tamaño de letra, código del viaje.
export interface Settings {
  profile: Who | null;
  tripCode: string | null;
  theme: 'auto' | 'light' | 'dark';
  largeText: boolean;
  onboarded: boolean;
  deviceId: string;
}

const KEY = 'roma-settings';
const EVENT = 'roma-settings-change';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const defaults = (): Settings => ({ profile: null, tripCode: null, theme: 'auto', largeText: false, onboarded: false, deviceId: uuid() });

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  let s = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<Settings>) };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* sin almacenamiento: valores por defecto en memoria */ }
  cache = s;
  return s;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = { ...getSettings(), ...patch };
  cache = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  applyAppearance(s);
  window.dispatchEvent(new Event(EVENT));
  return s;
}

export function applyAppearance(s: Settings = getSettings()): void {
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  if (s.largeText) root.setAttribute('data-text', 'large');
  else root.removeAttribute('data-text');
}

export function useSettings(): Settings {
  const [s, setS] = useState(getSettings);
  useEffect(() => {
    const on = () => setS(getSettings());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return s;
}

export function resetLocalSettings(): void {
  cache = null;
  try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch { /* ignore */ }
}
