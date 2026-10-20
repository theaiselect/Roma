// «Probar conexión» de Ajustes: dice en palabras llanas qué falla (red, servidor o código del viaje).

export interface ConnectionStep { ok: boolean; text: string }
export interface ConnectionReport { ok: boolean; steps: ConnectionStep[] }

interface Opts {
  tripCode: string | null;
  profile: string | null;
  online: boolean;
  fetchFn?: typeof fetch;
}

export async function checkConnection({ tripCode, profile, online, fetchFn = fetch }: Opts): Promise<ConnectionReport> {
  const steps: ConnectionStep[] = [];
  const done = (): ConnectionReport => ({ ok: steps.every((s) => s.ok), steps });

  if (!online) {
    steps.push({ ok: false, text: 'Este móvil no tiene conexión a internet. Activa el wifi o los datos y vuelve a probar.' });
    return done();
  }

  try {
    const res = await fetchFn('/api/health', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const h = (await res.json()) as { tripCode?: boolean; redis?: boolean; blob?: boolean };
    steps.push({ ok: true, text: 'El servidor responde.' });
    steps.push({ ok: h.tripCode === true, text: h.tripCode ? 'El servidor tiene el código del viaje.' : 'Al servidor le falta el código del viaje (variable TRIP_CODE en Vercel).' });
    steps.push({ ok: h.redis === true, text: h.redis ? 'La base de datos (Redis) está conectada.' : 'Falta conectar la base de datos Redis en Vercel.' });
    steps.push({ ok: h.blob === true, text: h.blob ? 'El almacén de archivos (Blob) está conectado.' : 'Falta conectar el almacén de archivos (Blob) en Vercel: sin él no se comparten fotos ni entradas.' });
  } catch {
    steps.push({ ok: false, text: 'No se llega al servidor. Puede ser la cobertura; prueba otra vez en un momento.' });
    return done();
  }

  if (!tripCode) {
    steps.push({ ok: false, text: 'Falta el código del viaje en este móvil: ponlo arriba y pulsa «Guardar código».' });
    return done();
  }

  try {
    const res = await fetchFn(`/api/sync?since=${Date.now()}`, { cache: 'no-store', headers: { 'x-trip-code': tripCode, 'x-who': profile ?? '' } });
    if (res.ok) steps.push({ ok: true, text: 'El código es correcto y la sincronización funciona.' });
    else if (res.status === 401) steps.push({ ok: false, text: 'El código no coincide con el del servidor. Es nuestra fecha (dd/mm/aaaa), con o sin barras; revísala con «Mostrar el código».' });
    else if (res.status === 429) steps.push({ ok: false, text: 'Demasiados intentos con un código equivocado: espera unos 5 minutos.' });
    else if (res.status === 501 || res.status === 503) steps.push({ ok: false, text: 'El servidor aún no está configurado del todo (mira los puntos de arriba).' });
    else steps.push({ ok: false, text: `El servidor contestó con un error (${res.status}). Prueba más tarde.` });
  } catch {
    steps.push({ ok: false, text: 'Se cortó la conexión al comprobar el código. Prueba otra vez.' });
  }
  return done();
}
