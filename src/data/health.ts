// Salud (F33). Datos con fuente, comprobados el 19 oct 2026.
export interface HealthPlace { id: string; name: string; kind: 'hospital' | 'pharmacy' | 'line'; address?: string; phone?: string; note: string; source: string }

export const healthPlaces: HealthPlace[] = [
  {
    id: 'isola-tiberina', name: 'Ospedale Isola Tiberina (Gemelli Isola)', kind: 'hospital',
    address: 'Via di Ponte Quattro Capi 39 (Isla Tiberina)', phone: '+39 06 68371',
    note: 'Urgencias (Pronto Soccorso); se entra por el lado del Ponte Cestio. Horario de urgencias: verificar en la centralita. Cerca del Gueto y de Trastevere.',
    source: 'https://www.ospedaleisolatiberina.it/wp-content/uploads/2023/09/Carta-dei-SERVIZI.pdf',
  },
  {
    id: 'santo-spirito', name: 'Ospedale Santo Spirito in Sassia', kind: 'hospital',
    address: 'Lungotevere in Sassia 1',
    note: 'Urgencias junto al Vaticano y Castel Sant\'Angelo (días III y IV). Teléfono y horario: verificar.',
    source: 'https://www.qsalute.it/pronto-soccorso-ospedale-santo-spirito-roma/',
  },
  {
    id: 'farmacia-barberini', name: 'Farmacia Internazionale Barberini', kind: 'pharmacy',
    address: 'Piazza Barberini 49', phone: '+39 06 4825456',
    note: 'A dos minutos del hotel. Suele abrir hasta tarde y en fin de semana; horario exacto: llamar.',
    source: 'https://www.wantedinrome.com/yellowpage/farmacia-internazionale.html',
  },
  {
    id: '116117', name: 'Médico no urgente (Lazio)', kind: 'line', phone: '116117',
    note: 'Consejo médico y guardia médica para cosas que no son una emergencia.',
    source: 'https://www.aslroma1.it/uploads/files/05_03_ASLRoma1-GuardiaMedicaTuristica-FLYER_D.pdf',
  },
];
