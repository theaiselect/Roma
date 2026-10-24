import type { MustItem } from '@/data/musts';

export function MustRow({ m }: { m: MustItem }) {
  return (
    <li class="stack" style={{ gap: '0.15rem' }}>
      <p><strong>{m.time ? <span class="num">{m.time} · </span> : null}{m.text}</strong></p>
      {m.note && <p class="small muted">{m.note}</p>}
    </li>
  );
}
