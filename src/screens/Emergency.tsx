import { Icon } from '@/components/Icon';
import { ShareLocation } from '@/components/ShareLocation';
import { telHref } from '@/components/StopCard';
import { consulateEmail, emergencyContacts, healthCard, lostDocumentSteps } from '@/data/emergency';
import { BackTitle } from '@/screens/More';
import { HealthPlaces } from '@/screens/health';
import { HotelCard, MyCardSection } from '@/screens/emergency-extras';

/** Emergencias (F32): todo funciona sin conexión; los teléfonos son enlaces tel:. */
export function Emergency() {
  return (
    <div class="stack-lg">
      <BackTitle title="Emergencias y salud" />
      <a class="btn danger block" href="tel:112" style={{ minHeight: '3.5rem', fontSize: '1.2rem' }}><Icon name="phone" /> Llamar al 112</a>
      <section class="card stack">
        <h2>Si necesitas que te encuentren</h2>
        <p class="small">Manda a Lucía (o a quien quieras) un enlace con el punto exacto donde estás.</p>
        <ShareLocation />
        <a class="btn block" href="/mapa?f=pharmacy"><Icon name="map" /> Farmacias cerca de mí</a>
      </section>
      <HotelCard />
      <MyCardSection />
      <section class="stack">
        {emergencyContacts.filter((c) => c.id !== '112').map((c) => (
          <article key={c.id} class="card stack" style={{ gap: '0.4rem' }}>
            <h3>{c.label}</h3>
            {c.note && <p class="small">{c.note}</p>}
            {c.phone && <a class="btn" href={telHref(c.phone)}><Icon name="phone" /> <span class="num">{c.phone}</span></a>}
            {c.pending && <p class="small pending">⚠️ Pendiente de confirmar: {c.pending}</p>}
          </article>
        ))}
        <p class="small muted">Email del consulado: <a href={`mailto:${consulateEmail}`}>{consulateEmail}</a></p>
      </section>
      <section class="card stack">
        <h2>Si se pierde el DNI o el pasaporte</h2>
        <ol class="stack" style={{ paddingLeft: '1.2rem', margin: 0 }}>
          {lostDocumentSteps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>
      <section class="card stack">
        <h2>Tarjeta Sanitaria Europea</h2>
        {healthCard.map((s) => <p key={s} class="small">{s}</p>)}
      </section>
      <HealthPlaces />
    </div>
  );
}
