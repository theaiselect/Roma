import { ErrorBoundary, LocationProvider, Route, Router, lazy, useLocation } from 'preact-iso';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { LostButton } from '@/components/Lost';
import { isSimulated, stopSimulation } from '@/lib/clock';
import { useSettings } from '@/lib/settings';
import { useSyncStatus } from '@/lib/sync-status';
import { requestSync } from '@/lib/sync';
import { Onboarding } from '@/screens/Onboarding';
import { Today } from '@/screens/Today';

const Plan = lazy(() => import('@/screens/Plan').then((m) => m.Plan));
const MapScreen = lazy(() => import('@/screens/MapScreen').then((m) => m.MapScreen));
const Us = lazy(() => import('@/screens/Us').then((m) => m.Us));
const More = lazy(() => import('@/screens/More').then((m) => m.More));
const Reservations = lazy(() => import('@/screens/Reservations').then((m) => m.Reservations));
const Food = lazy(() => import('@/screens/Food').then((m) => m.Food));
const Transport = lazy(() => import('@/screens/Transport').then((m) => m.Transport));
const Emergency = lazy(() => import('@/screens/Emergency').then((m) => m.Emergency));
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen').then((m) => m.SettingsScreen));
const Extra = lazy(() => import('@/screens/extra').then((m) => m.Extra));

const tabs: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Hoy', icon: 'today', match: (p) => p === '/' },
  { href: '/plan', label: 'Plan', icon: 'plan', match: (p) => p.startsWith('/plan') },
  { href: '/mapa', label: 'Mapa', icon: 'map', match: (p) => p.startsWith('/mapa') },
  { href: '/nosotros', label: 'Nosotros', icon: 'heart', match: (p) => p.startsWith('/nosotros') },
  { href: '/mas', label: 'Más', icon: 'more', match: (p) => p.startsWith('/mas') },
];

function SyncDot() {
  const { state, pending } = useSyncStatus();
  const label = state === 'offline' ? 'Sin conexión' : state === 'pending' ? `${pending} cambios pendientes` : 'Sincronizado';
  return (
    <button type="button" class="syncbtn" onClick={() => void requestSync(true)} aria-label={`${label}. Toca para sincronizar`}>
      <span class={`dot ${state === 'offline' ? 'grey' : state === 'pending' ? 'ocre' : 'green'}`} />
      {state === 'pending' && <span class="num">{pending}</span>}
    </button>
  );
}

function TabBar() {
  const { path } = useLocation();
  return (
    <nav class="tabbar" aria-label="Secciones">
      {tabs.map((t) => (
        <a key={t.href} href={t.href} aria-current={t.match(path) ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}

function Shell({ needRefresh, updateServiceWorker }: { needRefresh: boolean; updateServiceWorker: (reload?: boolean) => Promise<void> }) {
  return (
    <div class="app">
      {isSimulated() && (
        <div class="sim">Hora simulada · <button type="button" class="btn ghost" style={{ minHeight: 0, padding: 0, color: 'inherit' }} onClick={() => { stopSimulation(); location.href = '/'; }}>volver a la hora real</button></div>
      )}
      <header class="topbar">
        <a href="/" style={{ textDecoration: 'none' }} aria-label="Hoy"><Logo /></a>
        <SyncDot />
      </header>
      <main class="content">
        <ErrorBoundary>
          <Router>
            <Route path="/" component={Today} />
            <Route path="/plan" component={Plan} />
            <Route path="/plan/:day" component={Plan} />
            <Route path="/mapa" component={MapScreen} />
            <Route path="/nosotros" component={Us} />
            <Route path="/nosotros/:section" component={Us} />
            <Route path="/mas" component={More} />
            <Route path="/mas/reservas" component={Reservations} />
            <Route path="/mas/comidas" component={Food} />
            <Route path="/mas/transporte" component={Transport} />
            <Route path="/mas/emergencias" component={Emergency} />
            <Route path="/mas/ajustes" component={SettingsScreen} />
            <Route path="/mas/:section" component={Extra} />
            <Route default component={Today} />
          </Router>
        </ErrorBoundary>
      </main>
      <LostButton />
      <TabBar />
      {needRefresh && (
        <div class="update" role="status">
          <span>Hay una versión nueva</span>
          <button type="button" class="btn primary" onClick={() => void updateServiceWorker(true)}>Actualizar</button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const s = useSettings();
  // El service worker se registra desde la primera pantalla (también en el onboarding):
  // así la app se cachea para usarla sin conexión y Chrome puede ofrecer instalarla.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  return (
    <LocationProvider>
      {s.onboarded && s.profile ? <Shell needRefresh={needRefresh} updateServiceWorker={updateServiceWorker} /> : <Onboarding />}
    </LocationProvider>
  );
}
