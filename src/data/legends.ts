// Leyendas de amor por lugar (F29). Aparecen en la parada correspondiente.
export interface Legend { id: string; placeId?: string; title: string; text: string }

export const legends: Legend[] = [
  {
    id: 'trevi', placeId: 'trevi', title: 'Las monedas de Trevi',
    text: 'Se tira de espaldas, con la mano derecha por encima del hombro izquierdo. La tradición dice: una moneda, volverás a Roma; dos, te enamorarás de alguien de aquí; tres, boda. Lo que cae al agua se recoge y va a obras de caridad.',
  },
  {
    id: 'bocca', placeId: 'bocca-verita', title: 'La Boca de la Verdad y San Valentín',
    text: 'Cuenta la leyenda medieval que la boca muerde la mano de quien miente; la escena más famosa es la de «Vacaciones en Roma». Y dentro de la misma iglesia, Santa Maria in Cosmedin, se guarda un relicario con el cráneo atribuido a San Valentín, coronado de flores.',
  },
  {
    id: 'cerradura', placeId: 'aventino', title: 'La cerradura del Aventino',
    text: 'Por el ojo de la cerradura del priorato de los Caballeros de Malta se ve la cúpula de San Pedro enmarcada por setos. Se suele decir que de un vistazo se ven tres «países»: la Orden de Malta, Italia y el Vaticano. Al lado, en el Giardino degli Aranci, la tradición cuenta que Santo Domingo plantó aquí el primer naranjo de Roma.',
  },
  {
    id: 'tosca', placeId: 'castel-santangelo', title: 'Tosca en Castel Sant\'Angelo',
    text: 'En el último acto de «Tosca», la ópera de Puccini, la protagonista pierde a su amado y se lanza desde lo alto de Castel Sant\'Angelo. Arriba, el ángel recuerda otra historia: en el año 590 el papa Gregorio Magno dijo haber visto al arcángel Miguel envainando la espada sobre el castillo, señal de que la peste terminaba.',
  },
  {
    id: 'keats', placeId: 'piazza-spagna', title: 'Las cartas de Keats',
    text: 'En la casa rosa junto a la escalinata murió en 1821 el poeta John Keats, con 25 años. Sus cartas de amor a Fanny Brawne están entre las más famosas de la literatura inglesa. Hoy es la Casa de Keats y Shelley.',
  },
  {
    id: 'dolce-vita', placeId: 'trevi', title: 'La dolce vita',
    text: 'En «La dolce vita» (1960), de Fellini, Anita Ekberg se mete en Trevi de madrugada y llama a Marcello. Hoy meterse en la fuente está prohibido: el baño, solo en la película.',
  },
  {
    id: 'milvio', title: 'Los candados de Ponte Milvio',
    text: 'Una novela de Federico Moccia puso de moda en 2006 colgar candados en las farolas de Ponte Milvio y tirar la llave al Tíber. Fueron tantos que el ayuntamiento los retiró. No está en el plan, pero queda al norte por si un día os sobra tiempo.',
  },
];
