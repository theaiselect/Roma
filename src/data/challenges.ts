// Retos de fotos en pareja (F40). Completar uno pide una foto.
export interface Challenge { id: string; text: string; placeId?: string }

export const challenges: Challenge[] = [
  { id: 'gianicolo-beso', text: 'Un beso en el Gianicolo al atardecer', placeId: 'gianicolo' },
  { id: 'gelato-cuchara', text: 'Un helado compartido con la misma cucharilla' },
  { id: 'trevi-moneda', text: 'Tirar una moneda a Trevi de espaldas, con la mano derecha por encima del hombro izquierdo', placeId: 'trevi' },
  { id: 'bocca-mano', text: 'La mano en la Boca de la Verdad… y decir una verdad', placeId: 'bocca-verita' },
  { id: 'cerradura', text: 'Lo que se ve por la cerradura de los Caballeros de Malta', placeId: 'aventino' },
  { id: 'coliseo-selfie', text: 'Selfi con el Coliseo detrás, los dos sonriendo de verdad', placeId: 'colosseo' },
  { id: 'oculo', text: 'El óculo del Panteón desde justo debajo', placeId: 'pantheon' },
  { id: 'cupula-vistas', text: 'Los dos en lo alto de la cúpula de San Pedro', placeId: 'cupola' },
  { id: 'brindis', text: 'Un brindis en Trastevere', placeId: 'trastevere' },
  { id: 'supplì-hilo', text: 'Un supplì «haciendo hilo» entre los dos', placeId: 'supplizio' },
  { id: 'vespa', text: 'Posar junto a una Vespa aparcada, como en una película' },
  { id: 'halloween', text: 'Los dos disfrazados (o casi) la noche de Halloween' },
  { id: 'sampietrini', text: 'Vuestros pies juntos sobre los adoquines (sampietrini)' },
  { id: 'reflejo', text: 'Vuestro reflejo en una fuente o un charco' },
  { id: 'aranci', text: 'La puesta de sol desde el Giardino degli Aranci', placeId: 'aventino' },
  { id: 'nasone', text: 'Beber de un nasone tapando el caño con el dedo' },
  { id: 'escalinata-pie', text: 'En la escalinata de Plaza de España… de pie, que sentarse está multado', placeId: 'piazza-spagna' },
  { id: 'termini-reencuentro', text: 'El reencuentro en Roma (la primera foto juntos del viaje)', placeId: 'termini' },
];
