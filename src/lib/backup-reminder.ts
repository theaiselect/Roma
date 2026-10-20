// ¿Toca recordar la copia de seguridad? Solo si hay algo que perder y hace días que no se guarda ninguna.
export const BACKUP_EVERY_MS = 3 * 24 * 3600_000;

export interface BackupReminderInput {
  now: number;
  lastAt: number | null;
  /** Diarios, fotos, gastos, notas de voz… (lo que se perdería). */
  items: number;
  /** Último día del viaje (inicio del día en que se vuelve). */
  returnAt: number;
  tripStartAt: number;
}

export type BackupReminder = null | { urgent: boolean; text: string };

export function backupReminder(i: BackupReminderInput): BackupReminder {
  if (i.items < 1 || i.now < i.tripStartAt) return null;
  const stale = i.lastAt === null || i.now - i.lastAt > BACKUP_EVERY_MS;
  if (!stale) return null;
  // Desde el día de la vuelta (y después del viaje) el aviso es más serio.
  if (i.now >= i.returnAt) return { urgent: true, text: 'Antes de volver, guarda una copia de vuestro viaje: diario, fotos y gastos en un solo archivo.' };
  return { urgent: false, text: i.lastAt === null ? 'Todavía no has guardado ninguna copia del viaje. Hazla cuando tengas wifi; son 10 segundos.' : 'Hace unos días que no guardas una copia del viaje. Hazla cuando tengas wifi.' };
}
