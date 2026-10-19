// Normas y multas de Roma (F31). Importes solo si están verificados en una fuente.
export interface Rule { title: string; text: string; fine?: string; source?: string }

export const rules: Rule[] = [
  {
    title: 'No sentarse en la escalinata de Plaza de España',
    text: 'Está prohibido sentarse o tumbarse en los escalones de Trinità dei Monti. La multa sube si además se ensucia (por ejemplo, comiendo o bebiendo).',
    fine: '250 € (hasta 400 € si se ensucia o se daña)',
    source: 'https://www.money.it/Roma-vietato-sedersi-scalinata-trinita-dei-monti',
  },
  {
    title: 'Nada de comer sentados en escalones de monumentos',
    text: 'Comer o beber sentado en la escalinata entra en la misma sanción. Pastificio Guerra y Pinsere: mejor de pie o en un banco, lejos de los escalones.',
    fine: 'Incluido en la de arriba',
    source: 'https://www.money.it/Roma-vietato-sedersi-scalinata-trinita-dei-monti',
  },
  {
    title: 'No bañarse ni meter los pies en las fuentes',
    text: 'Prohibido bañarse o meterse en las fuentes históricas (Trevi incluida). Tampoco sentarse en el borde de Trevi.',
    source: 'https://www.money.it/Roma-vietato-sedersi-scalinata-trinita-dei-monti',
  },
  {
    title: 'Ojo con los «centuriones» y las pulseras',
    text: 'Quien se ofrece a hacerse una foto disfrazado o a ponerte una pulsera «de regalo» luego pide dinero. Un «no, grazie» firme y seguir andando.',
  },
  {
    title: 'Fontana di Trevi tiene entrada',
    text: 'Para bajar a la fuente se pagan 2 € de 9 a 22; después de las 22:00 es gratis (por eso el plan del viernes es a las 22:00).',
  },
  {
    title: 'Vaticano: hombros y rodillas cubiertos',
    text: 'En los Museos Vaticanos y en San Pedro no dejan pasar con tirantes ni pantalón corto o falda por encima de la rodilla.',
  },
  {
    title: 'Coliseo: entrada nominativa',
    text: 'La entrada lleva el nombre de cada uno y piden el documento en el acceso.',
  },
  {
    title: 'Carteristas',
    text: 'Cuidado en el metro (línea A), el autobús 64, Termini y las colas. Mochila delante en los vagones llenos.',
  },
];
