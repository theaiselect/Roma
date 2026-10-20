import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { ShowCard } from '@/components/ShowCard';
import { hotel } from '@/data/emergency';
import { useLocal } from '@/lib/local';
import { usePrivate } from '@/lib/private';

/** Dirección del hotel para enseñar a un taxista, copiar o abrir en el mapa. */
export function HotelCard() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const priv = usePrivate()?.hotel;
  const copy = async () => {
    try { await navigator.clipboard.writeText(hotel.addressIt); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* el botón «Enseñar» sirve igual */ }
  };
  return (
    <section class="card stack" aria-label="Nuestro hotel">
      <h2>Nuestro hotel</h2>
      <p><b>{hotel.name}</b><br />{hotel.addressIt}</p>
      <div class="row">
        <button type="button" class="btn primary" onClick={() => setShow(true)}><Icon name="speaker" /> Enseñar al taxista</button>
        <button type="button" class="btn" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar dirección'}</button>
      </div>
      {priv?.bookingRef
        ? <p class="small">Reserva {priv.bookingSite ?? ''}: <b class="num">{priv.bookingRef}</b>{priv.pin ? <> · PIN <b class="num">{priv.pin}</b></> : null}</p>
        : <p class="small muted">El número de reserva aparece aquí cuando el móvil sincroniza con la contraseña del viaje.</p>}
      <p class="small muted">Recepción {hotel.reception}. De noche está cerrada: pregunta al hotel cómo dejar la llave.</p>
      {show && <ShowCard it={hotel.taxiIt} es={`${hotel.name} · ${hotel.addressIt}`} onClose={() => setShow(false)} />}
    </section>
  );
}

export interface MyCard { name: string; blood: string; allergies: string; insurance: string; contact: string }
export const EMPTY_CARD: MyCard = { name: '', blood: '', allergies: '', insurance: '', contact: '' };
export const CARD_KEY = 'roma-my-card';

const FIELDS: { key: keyof MyCard; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Nombre completo', placeholder: 'Como en el DNI' },
  { key: 'blood', label: 'Grupo sanguíneo', placeholder: 'Ej.: A+' },
  { key: 'allergies', label: 'Alergias o medicación', placeholder: 'Si no tienes, déjalo vacío' },
  { key: 'insurance', label: 'Seguro de viaje (compañía, póliza y teléfono)', placeholder: 'Ej.: Mapfre, póliza 123, +34 …' },
  { key: 'contact', label: 'Contacto de emergencia', placeholder: 'Nombre y teléfono' },
];

/** Ficha personal para una urgencia. Solo se guarda en este móvil: no se sincroniza ni se manda al servidor. */
export function MyCardSection() {
  const [card, setCard] = useLocal<MyCard>(CARD_KEY, EMPTY_CARD);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MyCard>(card);
  const filled = FIELDS.filter((f) => card[f.key].trim());
  return (
    <section class="card stack" aria-label="Mi ficha de emergencia">
      <div class="spread"><h2>Mi ficha</h2>
        <button type="button" class="btn ghost" onClick={() => { setDraft(card); setEditing(!editing); }}>{editing ? 'Cerrar' : filled.length ? 'Editar' : 'Rellenar'}</button>
      </div>
      <p class="small muted">Se guarda solo en este móvil (nadie más la ve, ni siquiera Lucía). Sirve para enseñarla a un médico.</p>
      {!editing && filled.length === 0 && <p class="small">Aún está vacía.</p>}
      {!editing && filled.length > 0 && (
        <dl class="stack" style={{ gap: '0.4rem', margin: 0 }}>
          {filled.map((f) => <div key={f.key}><dt class="eyebrow">{f.label}</dt><dd style={{ margin: 0 }}>{card[f.key]}</dd></div>)}
        </dl>
      )}
      {editing && (
        <form class="stack" onSubmit={(e) => { e.preventDefault(); setCard(Object.fromEntries(FIELDS.map((f) => [f.key, draft[f.key].trim()])) as unknown as MyCard); setEditing(false); }}>
          {FIELDS.map((f) => (
            <label key={f.key} class="field small">{f.label}
              <input type="text" value={draft[f.key]} placeholder={f.placeholder} onInput={(e) => setDraft({ ...draft, [f.key]: (e.target as HTMLInputElement).value })} />
            </label>
          ))}
          <button type="submit" class="btn primary">Guardar en este móvil</button>
        </form>
      )}
    </section>
  );
}
