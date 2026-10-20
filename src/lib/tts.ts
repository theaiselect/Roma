// Voz italiana con la Web Speech API (F30). Sin red: usa las voces instaladas en el móvil.

function voices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  const v = speechSynthesis.getVoices();
  if (v.length) return Promise.resolve(v);
  return new Promise((res) => {
    const done = () => res(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 1500);
  });
}

export async function italianVoice(): Promise<SpeechSynthesisVoice | null> {
  const v = await voices();
  return v.find((x) => x.lang === 'it-IT' && x.localService) ?? v.find((x) => x.lang?.startsWith('it')) ?? null;
}

export async function speakItalian(text: string, rate = 0.9): Promise<boolean> {
  const voice = await italianVoice();
  if (!voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  speechSynthesis.speak(u);
  return true;
}

export function voiceHelp(ios: boolean): string {
  return ios
    ? 'En el iPhone: Ajustes → Accesibilidad → Contenido leído → Voces → Italiano, y descarga una voz.'
    : 'En Android: Ajustes → Sistema → Idiomas → Salida de texto a voz → Servicios de voz de Google → Instalar datos de voz → Italiano.';
}

// Voz en español para la miniaudioguía (F28).
export async function spanishVoice(): Promise<SpeechSynthesisVoice | null> {
  const v = await voices();
  return v.find((x) => x.lang === 'es-ES' && x.localService) ?? v.find((x) => x.lang === 'es-ES') ?? v.find((x) => x.lang?.startsWith('es')) ?? null;
}

export async function speakSpanish(text: string, onEnd?: () => void): Promise<boolean> {
  if (!('speechSynthesis' in window)) return false;
  const voice = await spanishVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'es-ES';
  u.rate = 1;
  // Al cortarla otra voz (otra audioguía, una frase, la navegación) el navegador da «error», no «end».
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
