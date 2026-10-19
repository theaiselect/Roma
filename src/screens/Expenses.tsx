import { useState } from 'preact/hooks';
import { BlobImage } from '@/components/BlobImage';
import { Icon } from '@/components/Icon';
import { euros } from '@/components/StopCard';
import { budget, days, travellers } from '@/data/trip';
import type { DayNum, Who } from '@/data/types';
import { BackTitle } from '@/screens/More';
import { appNow } from '@/lib/clock';
import { putBlob, remove, save, useKind, type Entity } from '@/lib/db';
import { compressImage } from '@/lib/image';
import { balance, CATEGORIES, customSplit, equalSplit, foodSpentByDay, light, parseEuros, plannedFoodByDay, type Category, type ExpenseLike } from '@/lib/money';
import { useSettings } from '@/lib/settings';
import { romeParts } from '@/lib/time';

export type ExpenseEntity = Entity & ExpenseLike & { kind: 'expense'; note: string; photoBlobId?: string };

const WHO: Who[] = ['jesus', 'lucia'];
const LIGHT_CLS = { green: 'ok', ocre: 'warn', vino: 'bad' } as const;
const LIGHT_TXT = { green: 'Dentro del plan', ocre: 'Un poco por encima', vino: 'Por encima del plan' } as const;

function currentDay(): DayNum | null {
  const d = days.find((x) => x.date === romeParts(appNow()).date);
  return d?.day ?? null;
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const me = useSettings().profile ?? 'jesus';
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<Who>(me);
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [mine, setMine] = useState('');
  const [category, setCategory] = useState<Category>('comida');
  const [day, setDay] = useState<DayNum | null>(currentDay());
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const cents = parseEuros(amount);
  const mineCents = mode === 'custom' ? parseEuros(mine || '0') : null;
  const valid = cents !== null && cents > 0 && (mode === 'equal' || (mineCents !== null && mineCents <= cents));

  const submit = async () => {
    if (!valid || cents === null) return;
    const split = mode === 'equal' ? equalSplit(cents, paidBy) : customSplit(cents, me, mineCents ?? 0);
    const photoBlobId = photo ? await putBlob(await compressImage(photo)) : undefined;
    await save({ kind: 'expense', amountCents: cents, paidBy, split, category, day, note: note.trim(), ...(photoBlobId ? { photoBlobId } : {}) });
    onDone();
  };

  return (
    <section class="card stack" aria-label="Nuevo gasto">
      <label class="field">Importe (€)
        <input type="text" inputMode="decimal" value={amount} placeholder="0,00" onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
      </label>
      <div class="stack" style={{ gap: '0.3rem' }}>
        <span class="small" style={{ fontWeight: 600 }}>Pagó</span>
        <div class="segmented">{WHO.map((w) => <button type="button" key={w} aria-pressed={paidBy === w} onClick={() => setPaidBy(w)}>{travellers[w].name}</button>)}</div>
      </div>
      <div class="stack" style={{ gap: '0.3rem' }}>
        <span class="small" style={{ fontWeight: 600 }}>Reparto</span>
        <div class="segmented">
          <button type="button" aria-pressed={mode === 'equal'} onClick={() => setMode('equal')}>A medias</button>
          <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>Personalizado</button>
        </div>
        {mode === 'custom' && (
          <label class="field small">Mi parte (€)
            <input type="text" inputMode="decimal" value={mine} onInput={(e) => setMine((e.target as HTMLInputElement).value)} />
          </label>
        )}
      </div>
      <label class="field">Categoría
        <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as Category)}>
          {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label class="field">Día
        <select value={day ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setDay(v ? (Number(v) as DayNum) : null); }}>
          <option value="">Antes del viaje</option>
          {days.map((d) => <option key={d.day} value={d.day}>{d.roman} · {d.label}</option>)}
        </select>
      </label>
      <label class="field">Nota
        <input type="text" value={note} placeholder="Da Enzo, gelato…" onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
      </label>
      <label class="btn ghost" style={{ justifyContent: 'flex-start' }}>
        <Icon name="camera" /> {photo ? 'Foto del tique añadida' : 'Foto del tique (opcional)'}
        <input type="file" accept="image/*" capture="environment" class="sr-only" onChange={(e) => setPhoto((e.target as HTMLInputElement).files?.[0] ?? null)} />
      </label>
      <div class="row">
        <button type="button" class="btn primary" disabled={!valid} onClick={() => void submit()}>Guardar</button>
        <button type="button" class="btn ghost" onClick={onDone}>Cancelar</button>
      </div>
    </section>
  );
}

/** Gastos compartidos (F24), presupuesto semáforo (F25) y foto del tique (F26). */
export function Expenses() {
  const list = (useKind<ExpenseEntity>('expense') ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  const me = useSettings().profile ?? 'jesus';
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const b = balance(list);
  const plan = plannedFoodByDay();
  const spent = foodSpentByDay(list, me);
  const totalFood = Object.values(spent).reduce((a, c) => a + c, 0);

  return (
    <div class="stack-lg">
      <BackTitle title="Gastos" />
      <section class="card stack">
        <p class="eyebrow">Saldo</p>
        {b.debtor
          ? <h2 class="num">{travellers[b.debtor].name} debe {euros(b.amountCents)} a {travellers[b.debtor === 'jesus' ? 'lucia' : 'jesus'].name}</h2>
          : <h2>Estáis en paz</h2>}
        <p class="small muted num">Total gastado: {euros(b.totalCents)} · Pagado por Jesús {euros(b.paid.jesus)} · por Lucía {euros(b.paid.lucia)}</p>
      </section>

      <section class="card stack">
        <div class="spread"><h2>Comida: tu parte</h2><span class={`chip ${LIGHT_CLS[light(totalFood, budget.foodCapPPCents)]}`}>{euros(totalFood)} / {euros(budget.foodCapPPCents)}</span></div>
        <table class="simple small">
          <tbody>
            {days.map((d) => {
              const l = light(spent[d.day], plan[d.day]);
              return (
                <tr key={d.day}>
                  <th>{d.roman}</th>
                  <td class="num">{euros(spent[d.day])} de {euros(plan[d.day])}</td>
                  <td><span class={`chip ${LIGHT_CLS[l]}`}>{spent[d.day] ? LIGHT_TXT[l] : '—'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {adding ? <ExpenseForm onDone={() => setAdding(false)} /> : (
        <button type="button" class="btn primary block" onClick={() => setAdding(true)}><Icon name="plus" /> Añadir gasto</button>
      )}

      <section class="stack" aria-label="Lista de gastos">
        {list.length === 0 && <p class="muted">Aún no hay gastos.</p>}
        {list.map((e) => (
          <article key={e.id} class="card stack" style={{ gap: '0.35rem' }}>
            <button type="button" class="spread" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', minHeight: 'var(--tap)' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span><b class="num">{euros(e.amountCents)}</b> · {e.note || CATEGORIES.find(([k]) => k === e.category)?.[1]}</span>
              <span class="small muted">{e.day ? days.find((d) => d.day === e.day)?.roman : 'Antes'} · pagó {travellers[e.paidBy].name}</span>
            </button>
            {open === e.id && (
              <div class="stack">
                <p class="small num">Jesús {euros(e.split.jesus)} · Lucía {euros(e.split.lucia)}</p>
                {e.photoBlobId && <BlobImage id={e.photoBlobId} alt="Tique" />}
                <button type="button" class="btn ghost" onClick={() => { if (confirm('¿Borrar este gasto?')) void remove(e.id); }}><Icon name="trash" /> Borrar</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
