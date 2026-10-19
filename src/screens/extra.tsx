import { useRoute } from 'preact-iso';
import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { dishes, menuWords } from '@/data/dishes';
import { monuments } from '@/data/monuments';
import { packing, nightBefore } from '@/data/packing';
import { phraseGroups } from '@/data/phrases';
import { rules } from '@/data/rules';
import { days, travellers } from '@/data/trip';
import type { Who } from '@/data/types';
import { Expenses } from '@/screens/Expenses';
import { BackTitle } from '@/screens/More';
import { setCheck, useChecks } from '@/lib/checks';
import { remove, save, useKind, type Entity } from '@/lib/db';
import { buildIcs } from '@/lib/ics';
import { isIOS } from '@/lib/maps';
import { useTimeline } from '@/lib/plan-state';
import { useSettings } from '@/lib/settings';
import { speakItalian, voiceHelp } from '@/lib/tts';

const FLAG = { see: '✅ Lo vemos', pass: '👀 De paso', maybe: '💡 Si sobra tiempo', ticket: '⏳ Si sale entrada', none: 'No entra en este viaje' } as const;
const TIER = ['', 'Imprescindibles', 'Muy importantes', 'Importantes', 'Con más días', 'Alrededores'];

function Heart({ show }: { show: boolean }) {
  return show ? <span class="pop-heart" aria-hidden="true">♥</span> : null;
}

/** Monumentos (F27): marcar uno en un móvil lo marca en el otro. */
function Monuments() {
  const checks = useChecks('monuments');
  const [justMarked, setJustMarked] = useState<string | null>(null);
  const planned = monuments.filter((m) => m.flag === 'see' || m.flag === 'pass');
  const seen = monuments.filter((m) => checks.get(m.id)?.done).length;
  return (
    <div class="stack-lg">
      <BackTitle title="Monumentos" />
      <section class="card"><p class="countdown num" style={{ fontSize: '2.2rem' }}>{seen} de {planned.length} vistos</p><p class="small muted">Contando los que están en el plan (✅ y 👀). Puedes marcar cualquiera.</p></section>
      {[1, 2, 3, 4, 5].map((tier) => (
        <section key={tier} class="stack">
          <h2>{tier} · {TIER[tier]}</h2>
          <ul class="card list" style={{ padding: '0.5rem 1rem' }}>
            {monuments.filter((m) => m.tier === tier).map((m) => {
              const on = checks.get(m.id)?.done ?? false;
              return (
                <li key={m.id} class="leg" style={{ alignItems: 'center' }}>
                  <input type="checkbox" id={`m-${m.id}`} checked={on} onChange={(e) => {
                    const v = (e.target as HTMLInputElement).checked;
                    void setCheck('monuments', m.id, v);
                    if (v) { setJustMarked(m.id); window.setTimeout(() => setJustMarked(null), 900); }
                  }} />
                  <label for={`m-${m.id}`}>
                    <span class={on ? 'strike' : undefined}>{m.name}</span> <Heart show={justMarked === m.id} />
                    <br /><span class="small muted">{FLAG[m.flag]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Frases en italiano con voz (F30). */
function Phrases() {
  const [noVoice, setNoVoice] = useState(false);
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  return (
    <div class="stack-lg">
      <BackTitle title="Frases en italiano" />
      {noVoice && <div class="alert"><Icon name="alert" /><span>Este móvil no tiene voz italiana instalada. {voiceHelp(isIOS())}</span></div>}
      <input type="text" placeholder="Buscar…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Buscar frase" />
      {phraseGroups.map((g) => {
        const items = g.items.filter((p) => !ql || p.es.toLowerCase().includes(ql) || p.it.toLowerCase().includes(ql));
        if (!items.length) return null;
        return (
          <section key={g.id} class="stack">
            <h2>{g.title}</h2>
            {items.map((p) => (
              <button type="button" key={p.it} class="card" style={{ textAlign: 'left', border: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'grid', gap: '0.2rem' }}
                onClick={() => void speakItalian(p.it).then((ok) => setNoVoice(!ok))}>
                <span class="small muted">{p.es}</span>
                <span lang="it" style={{ fontSize: '1.2rem', fontWeight: 600 }}><Icon name="speaker" size={18} /> {p.it}</span>
                <span class="small" style={{ color: 'var(--terracotta)' }}>{p.say}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Chuleta de la carta romana (F14). */
function Menu() {
  const groups = [...new Set(dishes.map((d) => d.group))];
  return (
    <div class="stack-lg">
      <BackTitle title="La carta romana" />
      <section class="card stack" style={{ gap: '0.3rem' }}>
        {menuWords.map(([it, es]) => <p key={it} class="small"><b lang="it">{it}</b>: {es}</p>)}
      </section>
      {groups.map((g) => (
        <section key={g} class="stack">
          <h2>{g}</h2>
          {dishes.filter((d) => d.group === g).map((d) => (
            <article key={d.it} class="card" style={{ display: 'grid', gap: '0.2rem' }}>
              <button type="button" class="btn ghost" style={{ justifyContent: 'flex-start', padding: 0, minHeight: 0 }} onClick={() => void speakItalian(d.it)}>
                <h3 lang="it">{d.it}</h3> <Icon name="speaker" size={16} />
              </button>
              <p class="small">{d.es}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function PersonChecklist({ list, items, prefix = '' }: { list: 'packing' | 'nightBefore'; items: { id: string; text: string; note?: string }[]; prefix?: string }) {
  const checks = useChecks(list);
  const who: Who[] = ['jesus', 'lucia'];
  return (
    <table class="simple">
      <thead><tr><th>Cosa</th>{who.map((w) => <th key={w} style={{ textAlign: 'center' }}>{travellers[w].name}</th>)}</tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id}>
            <td>{i.text}{i.note && <div class="small muted">{i.note}</div>}</td>
            {who.map((w) => (
              <td key={w} style={{ textAlign: 'center' }}>
                <input type="checkbox" style={{ width: '26px', height: '26px', accentColor: 'var(--pino)' }} aria-label={`${travellers[w].name}: ${i.text}`}
                  checked={checks.get(`${prefix}${i.id}:${w}`)?.done ?? false}
                  onChange={(e) => void setCheck(list, `${prefix}${i.id}`, (e.target as HTMLInputElement).checked, { who: w })} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Maleta (F34) y noche anterior (F35). */
function Packing() {
  const [day, setDay] = useState(1);
  return (
    <div class="stack-lg">
      <BackTitle title="Maleta y noche anterior" />
      <section class="card stack"><h2>Maleta</h2><PersonChecklist list="packing" items={packing} /></section>
      <section class="card stack">
        <h2>Noche anterior</h2>
        <select value={day} onChange={(e) => setDay(Number((e.target as HTMLSelectElement).value))} aria-label="Día">
          {days.map((d) => <option key={d.day} value={d.day}>Antes del {d.roman} · {d.label}</option>)}
        </select>
        <PersonChecklist list="nightBefore" prefix={`${day}-`} items={nightBefore.filter((i) => !i.forDay || i.forDay === day)} />
        <p class="small muted">A partir de las 21:00 del día anterior aparece también en Hoy.</p>
      </section>
    </div>
  );
}

/** Normas y multas (F31). */
function Rules() {
  return (
    <div class="stack-lg">
      <BackTitle title="Normas y multas" />
      {rules.map((r) => (
        <article key={r.title} class="card stack" style={{ gap: '0.35rem' }}>
          <h3>{r.title}</h3>
          <p class="small">{r.text}</p>
          {r.fine && <p class="small"><span class="chip bad">Multa: {r.fine}</span></p>}
          {r.source && <a class="small" href={r.source} target="_blank" rel="noopener">Fuente</a>}
        </article>
      ))}
    </div>
  );
}

interface GiftEntity extends Entity { kind: 'gift'; forWhom: string; what: string; where: string; bought: boolean }

/** Lista de regalos (F37). */
function Gifts() {
  const gifts = useKind<GiftEntity>('gift') ?? [];
  const [f, setF] = useState({ forWhom: '', what: '', where: '' });
  return (
    <div class="stack-lg">
      <BackTitle title="Regalos" />
      <section class="card stack">
        <input type="text" placeholder="Para quién" value={f.forWhom} onInput={(e) => setF({ ...f, forWhom: (e.target as HTMLInputElement).value })} aria-label="Para quién" />
        <input type="text" placeholder="Qué" value={f.what} onInput={(e) => setF({ ...f, what: (e.target as HTMLInputElement).value })} aria-label="Qué" />
        <input type="text" placeholder="Dónde comprarlo" value={f.where} onInput={(e) => setF({ ...f, where: (e.target as HTMLInputElement).value })} aria-label="Dónde" />
        <button type="button" class="btn primary" disabled={!f.forWhom.trim() || !f.what.trim()} onClick={() => { void save({ kind: 'gift', ...f, bought: false }); setF({ forWhom: '', what: '', where: '' }); }}><Icon name="plus" /> Añadir</button>
      </section>
      <ul class="list">
        {gifts.sort((a, b) => Number(a.bought) - Number(b.bought)).map((g) => (
          <li key={g.id} class="card leg" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={g.bought} aria-label={`Comprado: ${g.what}`} onChange={(e) => void save({ ...g, bought: (e.target as HTMLInputElement).checked })} />
            <div class="spread">
              <span class={g.bought ? 'strike' : undefined}><b>{g.forWhom}</b>: {g.what}{g.where && <span class="small muted"> · {g.where}</span>}</span>
              <button type="button" class="btn ghost" aria-label="Quitar" onClick={() => void remove(g.id)}><Icon name="trash" /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Calendario .ics (F09). */
function Calendar() {
  const tl = useTimeline();
  const download = () => {
    const blob = new Blob([buildIcs(tl)], { type: 'text/calendar;charset=utf-8' });
    const file = new File([blob], 'roma-viaje.ics', { type: 'text/calendar' });
    if (isIOS() && navigator.canShare?.({ files: [file] })) { void navigator.share({ files: [file] }).catch(() => undefined); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roma-viaje.ics';
    a.click();
  };
  return (
    <div class="stack-lg">
      <BackTitle title="Calendario" />
      <section class="card stack">
        <p>Todas las paradas del viaje con un aviso 30 minutos antes. Sirve para Google Calendar y para el Calendario del iPhone.</p>
        <button type="button" class="btn primary" onClick={download}><Icon name="calendar" /> Descargar roma-viaje.ics</button>
        <p class="small muted">{isIOS() ? 'En el iPhone: elige «Calendario» en el menú de compartir o abre el archivo y pulsa «Añadir todo».' : 'En Android: abre el archivo descargado y elige Google Calendar.'} Si cambia el plan (por ejemplo, con lluvia), vuelve a descargarlo.</p>
      </section>
    </div>
  );
}

const SECTIONS: Record<string, () => preact.JSX.Element> = {
  gastos: Expenses, monumentos: Monuments, frases: Phrases, carta: Menu, maleta: Packing, normas: Rules, regalos: Gifts, calendario: Calendar,
};

export function Extra() {
  const { params } = useRoute();
  const C = SECTIONS[params.section ?? ''];
  useSettings();
  if (!C) return <div class="stack-lg"><BackTitle title="No encontrado" /></div>;
  return <C />;
}
