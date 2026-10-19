// Voz del móvil para las indicaciones (sin servicios externos). Solo si el navegador la trae.
export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string): void {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Mantiene la pantalla encendida mientras dura la navegación. Devuelve cómo soltarla. */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const lock = await nav.wakeLock?.request('screen');
    return () => { void lock?.release().catch(() => {}); };
  } catch {
    return () => {};
  }
}
