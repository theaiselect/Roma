import type { Monument, MonumentFlag } from './types';

// ✅ lo vemos · 👀 de paso · 💡 a pocos minutos, se puede añadir · ⏳ solo si sale entrada · (sin marca) no entra
const raw: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "✅ Coliseo · ✅ Basílica de San Pedro · ✅ Museos Vaticanos y Capilla Sixtina · ✅ Panteón · ✅ Foro Romano · ✅ Fontana di Trevi · ✅ Palatino · ✅ Plaza de San Pedro · ✅ Piazza Navona · ✅ Plaza de España, escalinata y Trinità dei Monti · ✅ Castel Sant'Angelo · ✅ Cúpula de San Pedro · ✅ Vittoriano y su terraza · ✅ Piazza del Campidoglio · ⏳ Galleria Borghese",
  2: "✅ Arco de Constantino · 👀 Foros Imperiales · 👀 Columna de Trajano · ✅ Circo Máximo · ✅ Boca de la Verdad · San Juan de Letrán · Santa María la Mayor · Museos Capitolinos · Termas de Caracalla · Vía Apia Antigua · Catacumbas · ✅ Piazza del Popolo · ✅ Terraza del Pincio · ✅ Villa Borghese (parque) · ✅ Gianicolo · ✅ Fontana dell'Acqua Paola · ✅ Ponte Sant'Angelo · ✅ Via della Conciliazione · ✅ Giardino degli Aranci · ✅ Ojo de la cerradura de Malta · ✅ Santa Maria del Popolo · 💡 San Luigi dei Francesi (Caravaggio) · 💡 San Pietro in Vincoli (Moisés) · 💡 Santa Maria della Vittoria · San Pablo Extramuros · Palazzo Massimo · Ara Pacis · Mausoleo de Augusto · Domus Aurea · 💡 Campo de' Fiori · ✅ Piazza Venezia",
  3: "💡 Sant'Ignazio · 👀 Santa Maria sopra Minerva · ✅ Tempietto de Bramante · ✅ Santa Maria in Trastevere · ✅ Santa Sabina · ✅ Templos del Foro Boario · 👀 Arco de Jano · ✅ Teatro de Marcelo · ✅ Gueto y Pórtico de Octavia · 💡 Isla Tiberina · 👀 Largo di Torre Argentina · 👀 Mercados de Trajano · San Clemente · Scala Santa · 👀 Il Gesù · 👀 Sant'Agnese in Agone · Galleria Doria Pamphilj · ✅ Palazzo Barberini · ✅ Fontana del Tritone · 👀 Fontana delle Api · Cripta de los Capuchinos · Quattro Fontane y San Carlino · Sant'Andrea al Quirinale · Palazzo del Quirinale · 👀 Columna de Marco Aurelio · 👀 Palazzo Montecitorio · 💡 Palazzo Farnese · Palazzo Spada · 👀 Pirámide Cestia · Cementerio Acatólico · 👀 Monte Testaccio · Termas de Diocleciano · Palazzo Altemps · ✅ Via Condotti · 👀 Via Veneto · 👀 Casa de Keats y Shelley · Villa Farnesina · Ponte Sisto · 💡 Grutas Vaticanas · 👀 Palazzo di Giustizia · Santa Croce in Gerusalemme · San Lorenzo Extramuros · Santo Stefano Rotondo · Santi Quattro Coronati · Mausoleo de Cecilia Metela · Parque de los Acueductos",
  4: "Villa Doria Pamphilj · Villa Torlonia · Villa Ada · Orto Botanico · Barrio Coppedè · EUR y el «Coliseo cuadrado» · Foro Italico · MAXXI · 👀 Galería de Arte Moderno de Roma · Galleria Nazionale d'Arte Moderna · Museo Etrusco de Villa Giulia · Centrale Montemartini · Puertas y Muralla Aureliana · Ponte Milvio · Cinecittà · Garbatella · Pigneto · Estadio de Domiciano (cerrado) · Crypta Balbi (cerrada)",
  5: 'Ostia Antica · Villa Adriana (Tívoli) · Villa d’Este (Tívoli) · Castel Gandolfo',
};

const FLAGS: [string, MonumentFlag][] = [['✅', 'see'], ['👀', 'pass'], ['💡', 'maybe'], ['⏳', 'ticket']];

export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseTier(tier: Monument['tier'], line: string): Monument[] {
  return line.split(' · ').map((chunk) => {
    let name = chunk.trim();
    let flag: MonumentFlag = 'none';
    for (const [emoji, f] of FLAGS) {
      if (name.startsWith(emoji)) { flag = f; name = name.slice(emoji.length).trim(); }
    }
    return { id: slugify(name), name, tier, flag };
  });
}

export const monuments: Monument[] = ([1, 2, 3, 4, 5] as const).flatMap((t) => parseTier(t, raw[t]));
