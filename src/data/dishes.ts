// Chuleta de la carta romana (F14): una línea por plato.
export interface Dish { it: string; es: string; group: 'Primi' | 'Secondi' | 'Contorni' | 'Fritti y calle' | 'Dulces' }

export const dishes: Dish[] = [
  { it: 'Cacio e pepe', es: 'Pasta con queso pecorino y mucha pimienta negra, emulsionada con el agua de cocción.', group: 'Primi' },
  { it: 'Carbonara', es: 'Huevo, guanciale (papada curada), pecorino y pimienta. Sin nata.', group: 'Primi' },
  { it: 'Amatriciana', es: 'Tomate, guanciale y pecorino; a menudo con bucatini.', group: 'Primi' },
  { it: 'Gricia', es: 'La «amatriciana blanca»: guanciale, pecorino y pimienta, sin tomate.', group: 'Primi' },
  { it: 'Rigatoni con la pajata', es: 'Pasta con intestino de ternera lechal en salsa de tomate. Para valientes.', group: 'Primi' },
  { it: 'Gnocchi', es: 'Ñoquis de patata; en Roma, tradicionalmente los jueves.', group: 'Primi' },
  { it: 'Saltimbocca alla romana', es: 'Filetes de ternera con jamón y salvia, al vino blanco.', group: 'Secondi' },
  { it: 'Abbacchio a scottadito', es: 'Chuletillas de cordero lechal a la brasa, se comen con la mano.', group: 'Secondi' },
  { it: 'Coda alla vaccinara', es: 'Rabo de buey guisado con tomate y apio.', group: 'Secondi' },
  { it: 'Trippa alla romana', es: 'Callos en tomate con menta y pecorino.', group: 'Secondi' },
  { it: 'Polpette al sugo', es: 'Albóndigas en salsa de tomate.', group: 'Secondi' },
  { it: 'Carciofi alla romana', es: 'Alcachofas estofadas con menta y ajo.', group: 'Contorni' },
  { it: 'Carciofi alla giudia', es: 'Alcachofa frita entera, crujiente como una flor (cocina judía del Gueto).', group: 'Contorni' },
  { it: 'Cicoria ripassata', es: 'Achicoria salteada con ajo, aceite y guindilla.', group: 'Contorni' },
  { it: 'Puntarelle', es: 'Brotes de achicoria crudos con aliño de anchoa y ajo (de temporada fría).', group: 'Contorni' },
  { it: 'Supplì', es: 'Croqueta de arroz con tomate y mozzarella dentro, que «hace hilo» al morderla.', group: 'Fritti y calle' },
  { it: 'Fiori di zucca', es: 'Flores de calabacín rellenas de mozzarella y anchoa, rebozadas.', group: 'Fritti y calle' },
  { it: 'Filetti di baccalà', es: 'Tiras de bacalao rebozadas y fritas.', group: 'Fritti y calle' },
  { it: 'Pizza al taglio', es: 'Pizza en porciones rectangulares, se paga al peso.', group: 'Fritti y calle' },
  { it: 'Pizza bianca', es: 'Pan plano con aceite y sal; relleno de mortadela es un clásico.', group: 'Fritti y calle' },
  { it: 'Trapizzino', es: 'Triángulo de pizza blanca relleno de guisos romanos.', group: 'Fritti y calle' },
  { it: 'Maritozzo', es: 'Bollo dulce partido y lleno de nata montada; de desayuno.', group: 'Dulces' },
  { it: 'Tiramisù', es: 'Bizcocho con café, mascarpone y cacao.', group: 'Dulces' },
  { it: 'Crostata di ricotta e visciole', es: 'Tarta de requesón y guindas, típica del Gueto.', group: 'Dulces' },
  { it: 'Gelato', es: 'Helado artesano: busca colores apagados y montones bajos, no torres fluorescentes.', group: 'Dulces' },
];

export const menuWords: [string, string][] = [
  ['Antipasti', 'Entrantes'], ['Primi', 'Primeros (pasta, arroz, sopa)'], ['Secondi', 'Segundos (carne, pescado)'],
  ['Contorni', 'Guarniciones (se piden aparte)'], ['Coperto', 'Cubierto: suplemento por persona'], ['Servizio incluso', 'Servicio incluido'],
];
