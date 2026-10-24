import type { Place } from './types';

// Fuente: «Amor · Roma — Documento de implementación» (18 oct 2026).
// verified:false = dato sin comprobar en web oficial o sin coordenadas en el documento.
const DOC = 'Documento de implementación';
const WIKI = 'Wikipedia (coordenadas del artículo), consultado el 19 oct 2026';

// Coordenadas comprobadas en Wikipedia. El Pincio y el hotel no tienen: «Cómo llegar» usa el nombre y la dirección.
const MONUMENT_COORDS: Record<string, [number, number]> = {
  'villa-borghese': [41.91417, 12.49222],
  'piazza-popolo': [41.9107, 12.4763],
  'piazza-spagna': [41.9061, 12.4828],
  'trevi': [41.90083, 12.48306],
  'colosseo': [41.8903, 12.4922],
  'palatino': [41.888948, 12.48682],
  'foro-romano': [41.8922, 12.4852],
  'ghetto': [41.892436, 12.478533],
  'teatro-marcello': [41.89191, 12.47948],
  'bocca-verita': [41.88806, 12.48167],
  'circo-massimo': [41.8859, 12.4857],
  'aventino': [41.884444, 12.479722],
  'palazzo-barberini': [41.90361, 12.49028],
  'castel-santangelo': [41.9031, 12.4663],
  'gianicolo': [41.88875, 12.46417],
  'tempietto': [41.88875, 12.46641],
  'trastevere': [41.88944, 12.46972],
  'musei-vaticani': [41.9064, 12.4544],
  'san-pietro': [41.90222, 12.45333],
  'cupola': [41.90222, 12.45333],
  'navona': [41.899, 12.4731],
  'pantheon': [41.8986, 12.4768],
  'vittoriano': [41.8947, 12.4831],
  'campidoglio': [41.89333, 12.48278],
  'termini': [41.90083, 12.50194],
};

export const places: Place[] = [
  // ── Alojamiento ───────────────────────────────────────────────
  { id: 'hotel-soha', name: 'Soha Piazza di Spagna Boutique', kind: 'hotel', address: 'Via Zucchelli 32 (1.º piso, ascensor), junto al metro Barberini', verified: false, note: 'Coordenadas, teléfono y email: verificar' },

  // ── Comida, café, helado ──────────────────────────────────────
  { id: 'pinsere', name: 'Pinsere', kind: 'food', address: 'Via Flavia 98', lat: 41.9076155, lng: 12.4977767, hours: { mon: '10:00-21:00', tue: '10:00-21:00', wed: '10:00-21:00', thu: '10:00-21:00', fri: '10:00-21:00' }, pricePPCents: 900, verified: false, source: DOC },
  { id: 'come-il-latte', name: 'Come il Latte', kind: 'gelato', address: 'Via Silvio Spaventa 24/26', lat: 41.9070945, lng: 12.4960538, hoursText: '12–23', pricePPCents: 400, verified: false, source: DOC },
  { id: 'antica-birreria-peroni', name: 'Antica Birreria Peroni', kind: 'food', address: 'Via di S. Marcello 19', lat: 41.8987803, lng: 12.4824441, hours: { mon: '12:00-23:30', tue: '12:00-23:30', wed: '12:00-23:30', thu: '12:00-23:30', fri: '12:00-23:30', sat: '12:00-23:30', sun: null }, pricePPCents: 1800, phone: '+39 06 679 5310', verified: false, source: DOC },
  // Cena del viernes cambiada el 24 oct (presupuesto de comida subido a 230 € p. p.). Sin coordenadas: «Cómo llegar» usa la dirección.
  { id: 'roscioli-salumeria', name: 'Roscioli Salumeria con Cucina', kind: 'food', address: 'Via dei Giubbonari 21', hoursText: 'Todos los días 9–23:30 (Guía Michelin)', pricePPCents: 5500, phone: '+39 06 687 5287', note: 'Reservar', order: ['Carbonara', 'Burrata', 'Tabla de embutidos y quesos'], verified: false, source: 'Guía Michelin, consultada el 24 oct 2026' },
  // Cena del lunes cambiada el 24 oct: Taverna dei Fori solo reserva por teléfono. Sin coordenadas: «Cómo llegar» usa la dirección.
  { id: 'la-carbonara-monti', name: 'La Carbonara', kind: 'food', address: 'Via Panisperna 214', hours: { mon: '12:30-14:30,19:00-22:00', tue: '12:30-14:30,19:00-22:00', wed: '12:30-14:30,19:00-22:00', thu: '12:30-14:30,19:00-22:00', fri: '12:30-14:30,19:00-22:00', sat: '12:30-14:30,19:00-22:00', sun: null }, pricePPCents: 3000, phone: '+39 06 482 5176', note: 'Reservar online. Desde 1906', order: ['Carbonara', 'Carciofo alla romana'], verified: false, source: 'AutoReserve, consultado el 24 oct 2026' },
  { id: 'dar-bruttone', name: 'Dar Bruttone', kind: 'food', address: 'Via dei Serpenti 113', hoursText: 'Todos los días 12–23', pricePPCents: 3000, note: 'Reservar online: darbruttonerionemonti.plateform.app', verified: false, source: 'Web del restaurante, consultada el 24 oct 2026' },
  // Cambios del 24 oct, a petición de Jesús. Sin coordenadas: «Cómo llegar» usa la dirección.
  { id: 'piccolo-buco', name: 'Piccolo Buco', kind: 'food', address: 'Via del Lavatore 91', hours: { tue: '18:30-23:00', wed: '18:30-23:00', thu: '12:00-15:00,18:30-23:00', fri: '12:00-15:00,18:30-23:00', sat: '12:00-15:00,18:30-23:00', sun: '12:00-15:00,18:30-23:00' }, pricePPCents: 1500, phone: '+39 06 6938 0163', note: 'Pizza de borde gordo («canotto»), 12–18 €. Cierra los lunes', verified: false, source: 'Dissapore, consultado el 24 oct 2026' },
  { id: 'pastasciutta-trevi', name: 'Pastasciutta', kind: 'food', address: 'Largo Pietro di Brazzà 27', hoursText: 'Todos los días 10–22 (según sus otros locales: verificar)', pricePPCents: 800, phone: '+39 06 6932 7108', order: ['Carbonara', 'Cacio e pepe'], verified: false, source: 'Turismo Roma y Wanderlog, consultados el 24 oct 2026' },
  { id: 'regoli', name: 'Regoli', kind: 'cafe', address: 'Via dello Statuto 60', lat: 41.8948172, lng: 12.5009492, hours: { mon: '07:00-19:00', tue: null, wed: '07:00-19:00', thu: '07:00-19:00', fri: '07:00-19:00', sat: '07:00-19:00', sun: '07:00-19:00' }, pricePPCents: 600, phone: '+39 06 487 2812', note: 'Efectivo en barra', order: ['Maritozzo con panna'], verified: false, source: DOC },
  { id: 'da-enzo', name: 'Da Enzo al 29', kind: 'food', address: 'Via dei Vascellari 29', lat: 41.8880847, lng: 12.4778554, hours: { mon: '12:00-15:00,18:30-22:30', tue: '12:00-15:00,18:30-22:30', wed: '12:00-15:00,18:30-22:30', thu: '12:00-15:00,18:30-22:30', fri: '12:00-15:00,18:30-22:30', sat: '12:00-15:00,18:30-22:30', sun: null }, pricePPCents: 2900, order: ['Carciofo alla giudia (si ya hay alcachofas)', 'Amatriciana o cacio e pepe', 'Tiramisù'], verified: false, source: DOC },
  { id: 'sora-margherita', name: 'Sora Margherita', kind: 'food', address: 'P.za delle Cinque Scole 30', lat: 41.8929965, lng: 12.4765665, hours: { sat: '12:30-15:00' }, verified: false, source: DOC },
  { id: 'antico-forno-roscioli', name: 'Antico Forno Roscioli', kind: 'food', address: 'Via dei Chiavari 34', lat: 41.8945667, lng: 12.4742778, hoursText: '7:30–20', pricePPCents: 500, order: ['Pizza rossa', 'Pizza bianca'], verified: false, source: DOC },
  { id: 'felice-testaccio', name: 'Felice a Testaccio', kind: 'food', address: 'Via Mastro Giorgio 29', lat: 41.8785544, lng: 12.4774541, hours: { mon: '12:30-15:30,19:00-23:30', tue: '12:30-15:30,19:00-23:30', wed: '12:30-15:30,19:00-23:30', thu: '12:30-15:30,19:00-23:30', fri: '12:30-15:30,19:00-23:30', sat: '12:30-15:30,19:00-23:30', sun: '12:30-15:30,19:00-23:30' }, pricePPCents: 2600, phone: '+39 06 574 6800', note: 'Reservar', order: ['Tonnarelli cacio e pepe (la mezclan en la mesa)'], verified: false, source: DOC },
  { id: 'flavio-velavevodetto', name: 'Flavio al Velavevodetto', kind: 'food', address: 'Via di Monte Testaccio 97', lat: 41.876546, lng: 12.475987, phone: '+39 06 574 4194', verified: false, source: DOC },
  { id: 'trapizzino-testaccio', name: 'Trapizzino Testaccio', kind: 'food', address: 'Via Giovanni Branca 88', lat: 41.8796102, lng: 12.4736352, hoursText: 'Sábado hasta 01:00', pricePPCents: 800, verified: false, source: DOC },
  { id: 'faro', name: 'Faro Caffè Specialty', kind: 'cafe', address: 'Via Piave 55', lat: 41.9101512, lng: 12.4983926, hours: { sat: '09:00-17:00', sun: '09:00-17:00' }, pricePPCents: 1000, verified: false, source: DOC },
  { id: 'pastificio-guerra', name: 'Pastificio Guerra', kind: 'food', address: 'Via della Croce 8', lat: 41.9064463, lng: 12.4809389, hoursText: '13–21', pricePPCents: 600, note: 'No comer en la escalinata', verified: false, source: DOC },
  { id: 'two-sizes', name: 'Two Sizes', kind: 'gelato', address: 'Via del Governo Vecchio 88', lat: 41.8980142, lng: 12.471566, hours: { mon: null }, pricePPCents: 400, verified: false, source: DOC },
  { id: 'frigidarium', name: 'Frigidarium', kind: 'gelato', address: 'Via del Governo Vecchio 112', lat: 41.8982333, lng: 12.4704548, verified: false, source: DOC },
  { id: 'otaleg', name: 'Otaleg', kind: 'gelato', address: 'Via di S. Cosimato 14a', lat: 41.8881248, lng: 12.4704701, hoursText: '12–24', verified: false, source: DOC },
  { id: 'ai-marmi', name: 'Ai Marmi', kind: 'food', address: 'Viale di Trastevere 53–59', lat: 41.888251, lng: 12.4737127, hours: { mon: '18:30-02:00', tue: '18:30-02:00', wed: null, thu: '18:30-02:00', fri: '18:30-02:00', sat: '18:30-02:00', sun: '18:30-02:00' }, pricePPCents: 1400, order: ['Pizza romana fina', 'Supplì', 'Filetti di baccalà'], verified: false, source: DOC },
  { id: 'ivo-trastevere', name: 'Ivo a Trastevere', kind: 'food', lat: 41.8881329, lng: 12.4710707, verified: false, source: DOC },
  { id: 'da-augusto', name: 'Trattoria da Augusto', kind: 'food', address: "P.za de' Renzi 15", lat: 41.890473, lng: 12.4703403, note: 'Abre a diario (horas: verificar)', verified: false, source: DOC },
  { id: 'bar-san-calisto', name: 'Bar San Calisto', kind: 'bar', lat: 41.8890617, lng: 12.4708035, hoursText: '6:30–01:30', verified: false, source: DOC },
  { id: 'sciascia', name: 'Sciascia Caffè 1919', kind: 'cafe', address: 'Via Fabio Massimo 80/a', lat: 41.909859, lng: 12.461994, hoursText: '7–21:30', pricePPCents: 400, verified: false, source: DOC },
  { id: 'supplizio', name: 'Supplizio', kind: 'food', address: 'Via dei Banchi Vecchi 143', lat: 41.897487, lng: 12.467911, hours: { mon: '12:00-15:30,17:00-21:30' }, pricePPCents: 600, order: ['Supplì clásico'], verified: false, source: DOC },
  { id: 'gelateria-del-teatro', name: 'Gelateria del Teatro', kind: 'gelato', address: 'Via dei Coronari 65/66', lat: 41.9004943, lng: 12.4694946, hoursText: '11–23', pricePPCents: 400, verified: false, source: DOC },
  { id: 'sant-eustachio', name: "Sant'Eustachio Il Caffè", kind: 'cafe', lat: 41.8982749, lng: 12.4754254, pricePPCents: 200, order: ['Gran caffè'], verified: false, source: DOC },
  { id: 'boccione', name: 'Boccione', kind: 'food', address: "Via del Portico d'Ottavia 1", lat: 41.8932264, lng: 12.4769993, hours: { mon: '07:30-19:00', sat: null }, cashOnly: true, pricePPCents: 800, note: '8 € por 2 porciones. Sábado cerrado (Shabbat)', order: ['Crostata de ricotta e visciole'], verified: false, source: DOC },
  { id: 'taverna-fori', name: 'Taverna dei Fori Imperiali', kind: 'food', address: 'Via della Madonna dei Monti 9', lat: 41.8940615, lng: 12.4884778, hours: { tue: null }, pricePPCents: 3000, phone: '+39 06 679 8643', note: 'Reservar', order: ['Gricia o amatriciana', 'Polpette'], verified: false, source: DOC },

  // ── Otros sitios (Cerca de mí y planes B) ─────────────────────
  { id: 'nonna-betta', name: 'Nonna Betta', kind: 'food', lat: 41.8927778, lng: 12.4780556, verified: false, source: DOC },
  { id: 'torce', name: 'Torcè', kind: 'gelato', lat: 41.8814305, lng: 12.4857652, verified: false, source: DOC },
  { id: 'la-borghiciana', name: 'La Borghiciana', kind: 'food', lat: 41.9037256, lng: 12.46222, verified: false, source: DOC },
  { id: 'dar-filettaro', name: 'Dar Filettaro', kind: 'food', lat: 41.894683, lng: 12.473683, verified: false, source: DOC },
  { id: 'baffetto', name: 'Pizzeria da Baffetto', kind: 'food', lat: 41.8982758, lng: 12.4702938, verified: false, source: DOC },
  { id: 'pastasciutta', name: 'Pastasciutta', kind: 'food', lat: 41.899918, lng: 12.4837005, verified: false, source: DOC },
  { id: 'armando-pantheon', name: 'Armando al Pantheon', kind: 'food', address: "Salita de' Crescenzi 31", lat: 41.8990581, lng: 12.4761819, pricePPCents: 5000, phone: '+39 06 6880 3034', note: 'Reservar. Horario del viernes noche: verificar al llamar (unos 50 € p. p. según el Gambero Rosso)', verified: false, source: DOC },
  { id: 'pizzarium', name: 'Pizzarium', kind: 'food', lat: 41.9066758, lng: 12.4466709, verified: false, source: DOC },
  { id: 'caffe-commari', name: 'Caffè delle Commari', kind: 'cafe', lat: 41.908024, lng: 12.4540957, verified: false, source: DOC },
  { id: 'mordi-vai', name: 'Mordi & Vai', kind: 'food', lat: 41.8775111, lng: 12.4734033, verified: false, source: DOC },

  // ── Monumentos y zonas del itinerario (coordenadas: verificar) ─
  ...([
    ['villa-borghese', 'Villa Borghese', 'area'],
    ['pincio', 'Terraza del Pincio', 'monument'],
    ['piazza-popolo', 'Piazza del Popolo y Santa Maria del Popolo', 'monument'],
    ['piazza-spagna', 'Plaza de España y Via Condotti', 'monument'],
    ['trevi', 'Fontana di Trevi', 'monument'],
    ['colosseo', 'Coliseo y Arco de Constantino', 'monument'],
    ['palatino', 'Palatino', 'monument'],
    ['foro-romano', 'Foro Romano', 'monument'],
    ['ghetto', 'Gueto y Pórtico de Octavia', 'area'],
    ['teatro-marcello', 'Teatro de Marcelo', 'monument'],
    ['bocca-verita', 'Boca de la Verdad y templos del Foro Boario', 'monument'],
    ['circo-massimo', 'Circo Máximo', 'monument'],
    ['aventino', 'Aventino: Santa Sabina, Giardino degli Aranci y la cerradura de Malta', 'area'],
    ['palazzo-barberini', 'Palazzo Barberini', 'monument'],
    ['castel-santangelo', "Castel Sant'Angelo", 'monument'],
    ['gianicolo', "Gianicolo y Fontana dell'Acqua Paola", 'monument'],
    ['tempietto', 'Tempietto de Bramante (San Pietro in Montorio)', 'monument'],
    ['trastevere', 'Trastevere y Santa Maria in Trastevere', 'area'],
    ['musei-vaticani', 'Museos Vaticanos y Capilla Sixtina', 'monument'],
    ['san-pietro', 'Basílica de San Pedro', 'monument'],
    ['cupola', 'Cúpula de San Pedro', 'monument'],
    ['navona', 'Piazza Navona', 'monument'],
    ['pantheon', 'Panteón', 'monument'],
    ['vittoriano', 'Terraza del Vittoriano', 'monument'],
    ['campidoglio', 'Campidoglio', 'monument'],
    ['termini', 'Roma Termini', 'transport'],
  ] as const).map(([id, name, kind]): Place => {
    const c = MONUMENT_COORDS[id];
    return c ? { id, name, kind, lat: c[0], lng: c[1], verified: true, source: WIKI } : { id, name, kind, verified: false };
  }),

  // Alternativas bajo techo (plan de lluvia)
  { id: 'musei-capitolini', name: 'Museos Capitolinos', kind: 'monument', lat: 41.8931, lng: 12.4828, verified: true, source: WIKI },
  { id: 'san-luigi', name: 'San Luigi dei Francesi', kind: 'monument', lat: 41.89972, lng: 12.47472, verified: true, source: WIKI },
  { id: 'sant-ignazio', name: "Sant'Ignazio", kind: 'monument', lat: 41.899, lng: 12.479778, verified: true, source: WIKI },
  { id: 'san-pietro-vincoli', name: 'San Pietro in Vincoli', kind: 'monument', lat: 41.89389, lng: 12.49306, verified: true, source: WIKI },
  { id: 'santa-maria-vittoria', name: 'Santa Maria della Vittoria', kind: 'monument', verified: false },

  // ── Transporte ────────────────────────────────────────────────
  
  { id: 'barberini-metro', name: 'Metro Barberini (Línea A)', kind: 'transport', verified: false },
  { id: 'fco', name: 'Aeropuerto de Fiumicino (FCO)', kind: 'transport', verified: false },
  { id: 'svq', name: 'Aeropuerto de Sevilla (SVQ)', kind: 'transport', verified: false },
  { id: 'plaza-armas', name: 'Estación de autobuses Plaza de Armas (Sevilla)', kind: 'transport', verified: false },
  { id: 'mad-t1', name: 'Madrid-Barajas T1', kind: 'transport', verified: false },
];

export const placeById = new Map(places.map((p) => [p.id, p]));
