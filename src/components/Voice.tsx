import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { getBlob, putBlob } from '@/lib/db';
import { ensureBlob } from '@/lib/sync';

// Notas de voz (F42): hasta 2 min con MediaRecorder; el formato es el que dé el navegador (webm en Android, mp4 en iOS).
const MAX_MS = 120_000;

function pickMime(): string | undefined {
  const opts = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/aac'];
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m));
}

export function VoiceRecorder({ onSaved }: { onSaved: (blobId: string) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'saving'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);

  useEffect(() => {
    if (state !== 'rec') return;
    const id = window.setInterval(() => {
      const ms = Date.now() - started.current;
      setElapsed(ms);
      if (ms >= MAX_MS) rec.current?.stop();
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  if (typeof MediaRecorder === 'undefined') return null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('saving');
        const type = (r.mimeType || mime || 'audio/webm').split(';')[0]!;
        const id = await putBlob(new Blob(chunks.current, { type }));
        onSaved(id);
        setState('idle');
        setElapsed(0);
      };
      rec.current = r;
      started.current = Date.now();
      r.start(1000);
      setState('rec');
    } catch {
      alert('Sin permiso de micrófono. Actívalo en los ajustes del navegador para esta web.');
    }
  };

  const secs = Math.floor(elapsed / 1000);
  return state === 'rec' ? (
    <button type="button" class="btn danger" onClick={() => rec.current?.stop()}><Icon name="mic" /> Parar · <span class="num">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span> / 2:00</button>
  ) : (
    <button type="button" class="btn ghost" onClick={() => void start()} disabled={state === 'saving'}><Icon name="mic" /> {state === 'saving' ? 'Guardando…' : 'Nota de voz'}</button>
  );
}

export function VoiceNote({ blobId }: { blobId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void (async () => {
      await ensureBlob(blobId).catch(() => false);
      const b = await getBlob(blobId);
      if (b) { u = URL.createObjectURL(b); setUrl(u); }
    })();
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [blobId]);
  return url ? <audio controls src={url} style={{ width: '100%' }} /> : <p class="small muted">Nota de voz (sin descargar)</p>;
}
