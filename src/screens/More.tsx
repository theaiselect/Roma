import { Icon, type IconName } from '@/components/Icon';

export function BackTitle({ title, back = '/mas' }: { title: string; back?: string }) {
  return (
    <div class="stack" style={{ gap: '0.25rem' }}>
      <a href={back} class="btn ghost" style={{ justifySelf: 'start', paddingLeft: 0 }}><Icon name="back" /> Volver</a>
      <h1>{title}</h1>
    </div>
  );
}

export const moreItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/mas/reservas', label: 'Reservas y entradas', icon: 'ticket' },
  { href: '/mas/gastos', label: 'Gastos', icon: 'euro' },
  { href: '/mas/monumentos', label: 'Monumentos', icon: 'monument' },
  { href: '/mas/comidas', label: 'Comidas', icon: 'food' },
  { href: '/mas/carta', label: 'Chuleta de la carta romana', icon: 'book' },
  { href: '/mas/transporte', label: 'Transporte', icon: 'train' },
  { href: '/mas/frases', label: 'Frases en italiano', icon: 'speaker' },
  { href: '/mas/audioguia', label: 'Audioguía y leyendas', icon: 'monument' },
  { href: '/mas/emergencias', label: 'Emergencias y salud', icon: 'sos' },
  { href: '/mas/maleta', label: 'Maleta y noche anterior', icon: 'bag' },
  { href: '/mas/normas', label: 'Normas y multas', icon: 'rule' },
  { href: '/mas/regalos', label: 'Regalos', icon: 'gift' },
  { href: '/mas/calendario', label: 'Calendario (.ics)', icon: 'calendar' },
  { href: '/mas/ajustes', label: 'Ajustes', icon: 'settings' },
];

export function More() {
  return (
    <div class="stack-lg">
      <div class="page-title"><h1>Más</h1></div>
      <nav class="card menu" style={{ padding: 0 }} aria-label="Herramientas">
        {moreItems.map((i) => (
          <a key={i.href} href={i.href}>
            <Icon name={i.icon} />
            <span>{i.label}</span>
            <span class="chev"><Icon name="chevron" size={18} /></span>
          </a>
        ))}
      </nav>
    </div>
  );
}
