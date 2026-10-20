import { STAGE_LABEL, type Stage } from '@/lib/offline-data';

// «¿Está todo listo?»: lo que tiene que cumplirse en cada móvil antes de salir hacia Roma.

export type Fix = 'install' | 'download' | 'sync' | 'code' | 'partner';
export interface Check { id: string; ok: boolean; critical: boolean; title: string; detail: string; fix?: Fix }

export interface ReadyInput {
  now: number;
  installed: boolean;
  hasCode: boolean;
  /** Resultado de la prueba en vivo con el servidor; null = aún no probada. */
  server: { ok: boolean; text: string } | null;
  pending: number;
  lastSyncAt: number | null;
  partner: { name: string; seenAt: number | null };
  swReady: boolean;
  persisted: boolean | null;
  missing: Stage[];
  /** Archivos de este móvil que el servidor no ha aceptado (no llegan al otro móvil). */
  unshared?: number;
}

const H = 3600_000;
const D = 24 * H;

export function agoText(ms: number): string {
  if (ms < 2 * 60_000) return 'hace un momento';
  if (ms < H) return `hace ${Math.round(ms / 60_000)} min`;
  if (ms < D) return `hace ${Math.round(ms / H)} h`;
  const d = Math.round(ms / D);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export function readinessChecks(i: ReadyInput): Check[] {
  const out: Check[] = [];
  out.push({ id: 'install', critical: true, ok: i.installed, title: 'Instalada en la pantalla de inicio',
    detail: i.installed ? 'Abierta desde el icono.' : 'Instálala y ábrela siempre desde el icono: es la única forma de que guarde todo para usarla sin conexión.', fix: i.installed ? undefined : 'install' });

  if (!i.hasCode) out.push({ id: 'code', critical: true, ok: false, title: 'Contraseña del viaje', detail: 'Falta la contraseña en este móvil: sin ella no se comparte nada.', fix: 'code' });
  else if (i.server && !i.server.ok) out.push({ id: 'code', critical: true, ok: false, title: 'Contraseña y servidor', detail: i.server.text, fix: 'code' });
  else out.push({ id: 'code', critical: true, ok: true, title: 'Contraseña y servidor', detail: i.server ? 'La contraseña es correcta y el servidor responde.' : 'Contraseña guardada (pulsa «Comprobar» para probarla con el servidor).' });

  const sinceSync = i.lastSyncAt ? i.now - i.lastSyncAt : null;
  const syncOk = i.hasCode && i.pending === 0 && sinceSync !== null && sinceSync < D;
  out.push({ id: 'sync', critical: true, ok: syncOk, title: 'Sincronizada',
    detail: !i.hasCode ? 'Sin contraseña no hay sincronización.'
      : i.pending > 0 ? `${i.pending} ${i.pending === 1 ? 'cambio sin enviar' : 'cambios sin enviar'}: conecta a internet y pulsa «Sincronizar».`
      : sinceSync === null ? 'Todavía no se ha sincronizado nunca.'
      : sinceSync >= D ? `Última sincronización ${agoText(sinceSync)}.`
      : `Al día (${agoText(sinceSync)}).`,
    fix: syncOk ? undefined : 'sync' });

  const seen = i.partner.seenAt;
  const partnerOk = seen !== null && i.now - seen < 7 * D;
  out.push({ id: 'partner', critical: true, ok: partnerOk, title: `${i.partner.name} en su móvil`,
    detail: seen === null ? `${i.partner.name} todavía no ha abierto la app con la contraseña (o este móvil aún no ha recibido sus datos).`
      : partnerOk ? `${i.partner.name} se conectó ${agoText(i.now - seen)}.` : `${i.partner.name} no se conecta desde ${agoText(i.now - seen)}.`,
    fix: partnerOk ? undefined : 'partner' });

  out.push({ id: 'shell', critical: true, ok: i.swReady, title: 'App guardada para ir sin conexión', detail: i.swReady ? 'La app y sus pantallas ya están en este móvil.' : 'Todavía se está guardando: mantén la conexión un momento y vuelve a comprobar.' });

  const offOk = i.missing.length === 0;
  out.push({ id: 'offline', critical: true, ok: offOk, title: 'Roma guardada sin conexión',
    detail: offOk ? 'Mapa, calles, sitios, metro, relieve y fotos están guardados.' : `Falta: ${i.missing.map((s) => STAGE_LABEL[s].toLowerCase()).join(', ')}.`, fix: offOk ? undefined : 'download' });

  const un = i.unshared ?? 0;
  out.push({ id: 'files', critical: true, ok: un === 0, title: 'Archivos compartidos',
    detail: un === 0 ? 'Las entradas, fotos y notas de voz de este móvil llegan también al otro.' : `${un} ${un === 1 ? 'archivo no se ha podido' : 'archivos no se han podido'} compartir (demasiado grande o formato raro): mira las entradas en Reservas.` });

  out.push({ id: 'persist', critical: false, ok: i.persisted !== false, title: 'Almacenamiento protegido',
    detail: i.persisted === false ? 'El navegador podría borrar lo guardado si se queda sin espacio. Usa siempre la app instalada.' : 'El navegador no borrará lo guardado.' });
  return out;
}

export function failing(checks: Check[]): Check[] {
  return checks.filter((c) => !c.ok && c.critical);
}
