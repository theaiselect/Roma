export const transport = {
  metro: {
    lines: 'Líneas A, B y C',
    hours: { sunToThu: '05:30-23:30', friSat: '05:30-01:30' },
    ticket: 'BIT 1,50 € / 100 min; también contactless en los tornos',
    verify: 'Precio vigente del BIT',
    note: 'La vuelta del sábado 31 desde Testaccio es Línea B (Piramide) → Termini → Línea A.',
  },
  leonardoExpress: {
    firstFromTermini: '04:50',
    fromFco: { first: '05:38', last: '23:27' },
    minutes: 32,
    priceCents: 1400,
    platforms: 'Andenes 23–24 en Termini',
  },
  taxi: {
    fixedFareFcoCents: 5500,
    note: 'Taxi oficial blanco. Tarifa fija aeropuerto ↔ centro (dentro de la muralla Aureliana).',
    verify: 'Tarifa fija vigente',
  },
  strike: 'Huelga del 30 oct: no afecta, hay franja de garantía del 30 oct al 5 nov.',
} as const;
