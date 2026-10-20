import { useRoute } from 'preact-iso';
import { lazy } from 'preact-iso';
import { Icon, type IconName } from '@/components/Icon';
import { Diary } from '@/screens/us-diary';

const Photos = lazy(() => import('@/screens/us-photos').then((m) => m.Photos));
const Letters = lazy(() => import('@/screens/us-letters').then((m) => m.Letters));
const Capsule = lazy(() => import('@/screens/us-letters').then((m) => m.Capsule));
const Votes = lazy(() => import('@/screens/us-votes').then((m) => m.Votes));
const Postcard = lazy(() => import('@/screens/us-postcard').then((m) => m.Postcard));
const Songs = lazy(() => import('@/screens/us-songs').then((m) => m.Songs));
const Book = lazy(() => import('@/screens/us-book').then((m) => m.Book));

const sections: { id: string; label: string; icon: IconName }[] = [
  { id: 'diario', label: 'Diario', icon: 'book' },
  { id: 'fotos', label: 'Fotos y retos', icon: 'camera' },
  { id: 'cartas', label: 'Cartas', icon: 'mail' },
  { id: 'capsula', label: 'Cápsula', icon: 'clock' },
  { id: 'votos', label: 'Votos', icon: 'vote' },
  { id: 'cancion', label: 'Canción', icon: 'music' },
  { id: 'libro', label: 'Nuestro viaje', icon: 'star' },
];

const VIEWS: Record<string, () => preact.JSX.Element> = { diario: Diary, fotos: Photos, cartas: Letters, capsula: Capsule, votos: Votes, postal: Postcard, cancion: Songs, libro: Book };

export function Us() {
  const { params } = useRoute();
  const section = params.section ?? 'diario';
  const View = VIEWS[section] ?? Diary;
  return (
    <div class="stack-lg">
      <div class="page-title"><h1>Nosotros</h1></div>
      <nav class="legend scroll-row" aria-label="Secciones de Nosotros">
        {sections.map((s) => (
          <a key={s.id} href={`/nosotros/${s.id}`} class="btn" aria-current={s.id === section ? 'page' : undefined}
            style={s.id === section ? { background: 'var(--oro)', borderColor: 'var(--oro)', color: 'var(--on-oro)', minHeight: '40px' } : { minHeight: '40px' }}>
            <Icon name={s.icon} size={18} /> {s.label}
          </a>
        ))}
      </nav>
      <View />
    </div>
  );
}
