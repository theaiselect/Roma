import type { Stop } from './types';

export const itinerary: Stop[] = [
  // ── I · Viernes 30 de octubre ─────────────────────────────────
  { id: 'd1-bus', day: 1, start: '03:05', end: '07:35', placeId: 'plaza-armas', title: 'Bus Plasencia → Sevilla', note: 'Llega 07:35 a Plaza de Armas', leg: true, pending: 'hora y número de billete' },
  { id: 'd1-uber', day: 1, start: '07:40', placeId: 'svq', title: 'Uber Reserve a SVQ', note: 'Cancelación gratis hasta 1 h antes; mirar el bus a las 06:30; plan B taxi tarifa fija ~25 €', leg: true },
  { id: 'd1-flight', day: 1, start: '09:30', end: '12:35', placeId: 'fco', title: 'Ryanair SVQ → FCO', note: 'Llega 12:35; solo mochila 40×30×20', leg: true },
  { id: 'd1-leonardo', day: 1, start: '13:15', approx: true, placeId: 'termini', title: 'Leonardo Express FCO → Termini', note: '32 min, 14 €; andenes 23–24 en Termini', leg: true },
  { id: 'd1-lucia', day: 1, start: '13:50', placeId: 'termini', title: 'Encuentro con Lucía', note: 'Lucía llega a Termini a las 11:45, unas 2 h antes que Jesús', leg: true, pending: 'encuentro en Termini o en el hotel' },
  { id: 'd1-hotel', day: 1, placeId: 'hotel-soha', title: 'Metro A Termini → Barberini, dejar mochilas', leg: true },
  { id: 'd1-pinsere', day: 1, start: '14:30', placeId: 'pinsere', title: 'Comida en Pinsere' },
  { id: 'd1-latte', day: 1, start: '15:30', placeId: 'come-il-latte', title: 'Helado en Come il Latte' },
  { id: 'd1-borghese', day: 1, start: '16:00', placeId: 'villa-borghese', title: 'Paseo por Villa Borghese' },
  { id: 'd1-pincio', day: 1, start: '16:45', placeId: 'pincio', title: 'Mirador del Pincio' },
  { id: 'd1-popolo', day: 1, start: '17:30', placeId: 'piazza-popolo', title: 'Piazza del Popolo y Santa Maria del Popolo', note: 'Caravaggio' },
  { id: 'd1-spagna', day: 1, start: '18:30', placeId: 'piazza-spagna', title: 'Plaza de España y Via Condotti', note: 'No sentarse en la escalinata' },
  { id: 'd1-peroni', day: 1, start: '20:00', placeId: 'antica-birreria-peroni', title: 'Cena en Antica Birreria Peroni' },
  { id: 'd1-trevi', day: 1, start: '22:00', placeId: 'trevi', title: 'Fontana di Trevi', note: 'Gratis después de las 22:00 (2 € de 9 a 22; viernes desde 11:30)' },

  // ── II · Sábado 31 de octubre ─────────────────────────────────
  { id: 'd2-regoli', day: 2, start: '07:15', placeId: 'regoli', title: 'Desayuno en Regoli', note: 'Efectivo en barra. Después, paseo por Via Merulana' },
  { id: 'd2-colosseo', day: 2, start: '08:30', placeId: 'colosseo', title: 'Coliseo + Arco de Constantino', ticketId: 'colosseo', note: 'Nominativa: llevar DNI. Horario de invierno desde el 25 oct: última entrada 15:30, cierre 16:30' },
  { id: 'd2-palatino', day: 2, start: '10:15', placeId: 'palatino', title: 'Palatino', ticketId: 'colosseo', note: 'Misma entrada' },
  { id: 'd2-foro', day: 2, start: '11:30', placeId: 'foro-romano', title: 'Foro Romano', ticketId: 'colosseo', note: 'Salir por el Campidoglio' },
  { id: 'd2-enzo', day: 2, start: '13:15', placeId: 'da-enzo', title: 'Comida en Da Enzo al 29', planB: [
    { placeId: 'sora-margherita', reason: 'Si la cola pasa de 45 min' },
    { placeId: 'antico-forno-roscioli', reason: 'Si la cola pasa de 45 min' },
  ] },
  { id: 'd2-ghetto', day: 2, start: '14:45', placeId: 'ghetto', title: 'Gueto y Pórtico de Octavia', note: 'Shabbat: Boccione cerrado' },
  { id: 'd2-marcello', day: 2, start: '15:00', placeId: 'teatro-marcello', title: 'Teatro de Marcelo', note: 'De paso' },
  { id: 'd2-bocca', day: 2, start: '15:20', placeId: 'bocca-verita', title: 'Boca de la Verdad y templos del Foro Boario', note: 'Cola corta a esta hora' },
  { id: 'd2-circo', day: 2, start: '15:50', placeId: 'circo-massimo', title: 'Circo Máximo', note: 'De paso' },
  { id: 'd2-aventino', day: 2, start: '16:30', placeId: 'aventino', title: 'Aventino', note: 'Santa Sabina, Giardino degli Aranci (atardecer), ojo de la cerradura de los Caballeros de Malta' },
  { id: 'd2-felice', day: 2, start: '19:30', placeId: 'felice-testaccio', title: 'Cena en Felice a Testaccio', ticketId: 'felice', planB: [
    { placeId: 'flavio-velavevodetto', reason: 'Si no hay mesa' },
  ] },
  { id: 'd2-copas', day: 2, start: '22:30', title: 'Copas de Halloween', note: 'Testaccio o Trastevere' },
  { id: 'd2-trapizzino', day: 2, start: '00:30', afterMidnight: true, placeId: 'trapizzino-testaccio', title: 'Trapizzino Testaccio', note: 'Sábado hasta 01:00. Vuelta: Línea B (Piramide) → Termini → Línea A, hasta 01:30' },

  // ── III · Domingo 1 de noviembre (festivo: Ognissanti) ────────
  { id: 'd3-faro', day: 3, start: '09:00', placeId: 'faro', title: 'Desayuno en Faro Caffè Specialty' },
  { id: 'd3-barberini', day: 3, start: '10:00', placeId: 'palazzo-barberini', title: 'Palazzo Barberini', note: 'Gratis el primer domingo; verificar que abre en festivo. Plan B de la Borghese (agotada): seguir mirando tosc.it' },
  { id: 'd3-guerra', day: 3, start: '13:00', placeId: 'pastificio-guerra', title: 'Comida en Pastificio Guerra', note: 'No comer en la escalinata' },
  { id: 'd3-postre', day: 3, start: '14:00', placeId: 'two-sizes', title: 'Postre en Two Sizes o Frigidarium', planB: [
    { placeId: 'frigidarium', reason: 'Alternativa en la misma calle' },
  ] },
  { id: 'd3-castel', day: 3, start: '14:30', placeId: 'castel-santangelo', title: "Castel Sant'Angelo", note: 'Gratis el primer domingo; verificar que abre en festivo' },
  { id: 'd3-gianicolo-up', day: 3, start: '16:15', placeId: 'gianicolo', title: "Subida al Gianicolo por la Fontana dell'Acqua Paola" },
  { id: 'd3-sunset', day: 3, start: '16:45', placeId: 'gianicolo', title: 'Atardecer en el Gianicolo', note: 'Hora exacta con SunCalc' },
  { id: 'd3-tempietto', day: 3, start: '17:30', placeId: 'tempietto', title: 'Tempietto de Bramante' },
  { id: 'd3-trastevere', day: 3, start: '18:00', placeId: 'trastevere', title: 'Trastevere y Santa Maria in Trastevere', note: 'Opcional: helado en Otaleg' },
  { id: 'd3-marmi', day: 3, start: '19:30', placeId: 'ai-marmi', title: 'Cena en Ai Marmi', planB: [
    { placeId: 'ivo-trastevere', reason: 'Si hay mucha cola' },
    { placeId: 'da-augusto', reason: 'Si hay mucha cola' },
  ] },
  { id: 'd3-calisto', day: 3, start: '21:30', placeId: 'bar-san-calisto', title: 'Copa en Bar San Calisto' },
  { id: 'd3-back', day: 3, placeId: 'hotel-soha', title: 'Vuelta al hotel', note: 'El metro cierra a las 23:30 el domingo: tranvía 8, taxi o 35–40 min a pie' },

  // ── IV · Lunes 2 de noviembre ─────────────────────────────────
  { id: 'd4-sciascia', day: 4, start: '07:00', placeId: 'sciascia', title: 'Desayuno en Sciascia Caffè 1919' },
  { id: 'd4-cola', day: 4, start: '07:45', placeId: 'musei-vaticani', title: 'Cola de entrada a los Museos Vaticanos', note: 'Viale Vaticano; hombros y rodillas cubiertos' },
  { id: 'd4-vaticani', day: 4, start: '08:00', placeId: 'musei-vaticani', title: 'Museos Vaticanos + Capilla Sixtina', ticketId: 'vaticani', note: '1 Intero + 1 Ridotto' },
  { id: 'd4-sanpietro', day: 4, start: '12:00', placeId: 'san-pietro', title: 'Basílica de San Pedro', note: 'Gratis' },
  { id: 'd4-cupola', day: 4, start: '13:00', placeId: 'cupola', title: 'Cúpula de San Pedro', note: 'Taquilla: 10 € escaleras / 15 € ascensor; 551 escalones' },
  { id: 'd4-supplizio', day: 4, start: '14:15', placeId: 'supplizio', title: 'Supplì en Supplizio' },
  { id: 'd4-roscioli', day: 4, start: '14:35', placeId: 'antico-forno-roscioli', title: 'Antico Forno Roscioli', note: 'Justo de tiempo: si vais tarde, seguir a Navona' },
  { id: 'd4-navona', day: 4, start: '15:00', placeId: 'navona', title: 'Piazza Navona' },
  { id: 'd4-teatro', day: 4, start: '15:10', placeId: 'gelateria-del-teatro', title: 'Helado en Gelateria del Teatro' },
  { id: 'd4-pantheon', day: 4, start: '15:35', placeId: 'pantheon', title: 'Panteón', ticketId: 'pantheon', note: 'Franja 15:00–16:00' },
  { id: 'd4-eustachio', day: 4, start: '16:05', placeId: 'sant-eustachio', title: "Café en Sant'Eustachio" },
  { id: 'd4-vittoriano', day: 4, start: '16:40', placeId: 'vittoriano', title: 'Terraza del Vittoriano', note: 'Reducida 5 €' },
  { id: 'd4-campidoglio', day: 4, start: '17:45', placeId: 'campidoglio', title: 'Campidoglio', note: 'Vistas del Foro al anochecer' },
  { id: 'd4-boccione', day: 4, start: '18:15', placeId: 'boccione', title: 'Boccione', note: 'Lunes hasta las 19:00 · solo efectivo' },
  { id: 'd4-taverna', day: 4, start: '19:45', placeId: 'taverna-fori', title: 'Cena en Taverna dei Fori Imperiali', ticketId: 'taverna' },

  // ── V · Martes 3 de noviembre ─────────────────────────────────
  { id: 'd5-alarm', day: 5, start: '05:00', title: 'Alarma', note: 'Mochilas hechas la noche antes', leg: true },
  { id: 'd5-metro', day: 5, start: '05:35', placeId: 'barberini-metro', title: 'Metro A Barberini → Termini', note: 'Plan B: taxi a las 05:45, tarifa fija 55 € al aeropuerto', leg: true },
  { id: 'd5-leonardo', day: 5, start: '06:05', end: '06:37', placeId: 'fco', title: 'Leonardo Express → FCO', note: 'Llega 06:37', leg: true },
  { id: 'd5-flight', day: 5, start: '09:00', end: '11:30', placeId: 'mad-t1', title: 'Ryanair FCO → Madrid T1', note: 'Llega ~11:30', leg: true },
  { id: 'd5-madrid', day: 5, start: '12:00', approx: true, title: 'Madrid: T1 → lanzadera gratis a T4 → Cercanías C1', note: 'A Atocha (Renfe) o Méndez Álvaro (Estación Sur, bus)', leg: true },
  { id: 'd5-home', day: 5, start: '13:30', approx: true, title: 'Madrid → Plasencia', leg: true, pending: 'billete sin comprar' },
];
