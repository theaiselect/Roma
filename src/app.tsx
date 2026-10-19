import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { Logo } from '@/components/Logo';
import { days, luciaTrain, tripStart } from '@/data/trip';
import { itinerary } from '@/data/itinerary';
import { daysUntil, now } from '@/lib/time';

// Fase 0: esqueleto desplegable. Las pantallas reales (Hoy, Plan, Mapa…) llegan en la fase 1.
export function App() {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const left = daysUntil(t, tripStart);

  return (
    <main class="shell">
      <Logo />

      <section class="card" aria-live="polite">
        {left > 0 ? (
          <>
            <p class="muted">Faltan</p>
            <p class="big num">{left} {left === 1 ? 'día' : 'días'}</p>
            <p>para Roma · 30 oct – 3 nov 2026</p>
          </>
        ) : left === 0 ? (
          <h2>¡Hoy empieza el viaje!</h2>
        ) : (
          <h2>Ciao, Roma</h2>
        )}
      </section>

      <section class="card">
        <h2>El viaje</h2>
        <ul class="days">
          {days.map((d) => (
            <li key={d.day}>
              <b>{d.roman}</b>
              <span>
                {d.label}
                {d.holiday && <span class="muted"> · {d.holiday}</span>}
                <span class="muted num"> · {itinerary.filter((s) => s.day === d.day).length} paradas</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section class="card">
        <h2>Pendiente</h2>
        <p>
          Lucía llega a Termini a las <span class="num">{luciaTrain.arrivesTermini}</span>.{' '}
          {luciaTrain.meetingPoint ? null : <span class="pending">⚠️ Pendiente de confirmar dónde os encontráis.</span>}
        </p>
        <p class="muted">Versión de preparación. Hoy, Plan, Mapa y Emergencias llegan en la siguiente entrega.</p>
      </section>

      {needRefresh && (
        <div class="update" role="status">
          <span>Hay una versión nueva</span>
          <button type="button" onClick={() => updateServiceWorker(true)}>Actualizar</button>
        </div>
      )}
    </main>
  );
}
