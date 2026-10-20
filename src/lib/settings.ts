import { useEffect, useState } from 'preact/hooks';
import type { Who } from '@/data/types';

// Ajustes locales (localStorage): perfil, tema, tamaño de letra, código del viaje.
export interface Settings {
  profile: Who | null;
  tripCode: string | null;
  theme: 'auto' | 'light' | 'dark';
  /** 2 = rediseño «Notte romana» (oscuro por defecto). */
  themeV?: number;
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

const defaults = (): Settings => ({ profile: null, tripCode: null, theme: 'dark', themeV: 2, largeText: false, onboarded: false, deviceId: uuid() });

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  let s = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      s = { ...s, ...(JSON.parse(raw) as Partial<Settings>) };
      // Ajustes guardados antes del rediseño: pasan a la noche romana (se puede cambiar en Ajustes).
      if (!s.themeV) { s.theme = 'dark'; s.themeV = 2; }
    }
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
  // Color de la barra del sistema según el tema que se ve.
  const dark = s.theme === 'dark' || (s.theme === 'auto' && (typeof matchMedia !== 'function' || matchMedia('(prefers-color-scheme: dark)').matches));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17110F' : '#F7F1E8');
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

/** ¿Se está viendo la app en oscuro? (tema elegido o, en «Automático», el del sistema). */
export function useDark(): boolean {
  const s = useSettings();
  const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);
  const [sys, setSys] = useState(() => query()?.matches ?? true);
  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const on = () => setSys(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return s.theme === 'dark' || (s.theme === 'auto' && sys);
}
