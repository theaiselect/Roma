import { euros } from '@/components/StopCard';
import { transport } from '@/data/transport';
import { BackTitle } from '@/screens/More';

export function Transport() {
  const t = transport;
  return (
    <div class="stack-lg">
      <BackTitle title="Transporte" />
      <section class="card stack">
        <h2>Metro</h2>
        <table class="simple">
          <tbody>
            <tr><th>Domingo a jueves</th><td class="num">{t.metro.hours.sunToThu.replace('-', '–')}</td></tr>
            <tr><th>Viernes y sábado</th><td class="num">{t.metro.hours.friSat.replace('-', '–')}</td></tr>
          </tbody>
        </table>
        <p class="small">{t.metro.lines}. {t.metro.ticket}. <span class="pending">Verificar: {t.metro.verify}.</span></p>
        <p class="small">{t.metro.note}</p>
        <p class="small">Hotel: metro <b>Barberini</b> (Línea A).</p>
      </section>
      <section class="card stack">
        <h2>Leonardo Express</h2>
        <table class="simple">
          <tbody>
            <tr><th>Primer tren desde Termini</th><td class="num">{t.leonardoExpress.firstFromTermini}</td></tr>
            <tr><th>Desde Fiumicino</th><td class="num">{t.leonardoExpress.fromFco.first}–{t.leonardoExpress.fromFco.last}</td></tr>
            <tr><th>Duración · precio</th><td class="num">{t.leonardoExpress.minutes} min · {euros(t.leonardoExpress.priceCents)}</td></tr>
          </tbody>
        </table>
        <p class="small">{t.leonardoExpress.platforms}.</p>
      </section>
      <section class="card stack">
        <h2>Taxi</h2>
        <p>{t.taxi.note}</p>
        <p>Desde Fiumicino: <b class="num">{euros(t.taxi.fixedFareFcoCents)}</b> <span class="pending small">({t.taxi.verify})</span></p>
        <p class="small muted">Solo taxis blancos oficiales, en la parada. No aceptes a quien te ofrezca taxi dentro de la terminal.</p>
      </section>
      <section class="card stack">
        <h2>Huelgas</h2>
        <p class="small">{t.strike}</p>
      </section>
    </div>
  );
}
