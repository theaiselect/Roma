// Notas de voz del diario: antes había una sola (`voiceBlobId`); ahora puede haber varias (`voiceBlobIds`).
export interface VoiceFields { voiceBlobId?: string; voiceBlobIds?: string[] }

/** Todas las notas de voz de una entrada, en orden, sin repetir y aceptando el formato antiguo. */
export function voiceIds(e?: VoiceFields | null): string[] {
  if (!e) return [];
  const out: string[] = [];
  for (const id of [...(e.voiceBlobIds ?? []), ...(e.voiceBlobId ? [e.voiceBlobId] : [])]) if (!out.includes(id)) out.push(id);
  return out;
}

/** Campos a guardar al añadir una nota (se pasa la lista actual completa; el campo antiguo se deja vacío). */
export function withVoice(e: VoiceFields | undefined, id: string): { voiceBlobIds: string[]; voiceBlobId: undefined } {
  return { voiceBlobIds: [...voiceIds(e), id], voiceBlobId: undefined };
}

export function withoutVoice(e: VoiceFields | undefined, id: string): { voiceBlobIds: string[]; voiceBlobId: undefined } {
  return { voiceBlobIds: voiceIds(e).filter((x) => x !== id), voiceBlobId: undefined };
}
