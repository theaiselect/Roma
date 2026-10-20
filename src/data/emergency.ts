// Fuentes comprobadas el 19 oct 2026:
// - Consulado: https://exteriores.gob.es/Consulados/roma/es/Consulado/Paginas/Horario,-Localizacion-y-Contacto.aspx
// - 112: Número Único de Emergencias activo en Roma y Lazio (regione.lazio.it)

export interface EmergencyContact {
  id: string;
  label: string;
  phone?: string;
  note?: string;
  pending?: string;
  source?: string;
}

export const emergencyContacts: EmergencyContact[] = [
  { id: '112', label: 'Emergencias (policía, ambulancia, bomberos)', phone: '112', note: 'Número único europeo. Gratis, también sin saldo.', source: 'https://www.regione.lazio.it/notizie/Inaugurata-nuova-sala-numero-unico-emergenza-112' },
  { id: 'consulado-emergencia', label: 'Consulado de España · emergencia consular', phone: '+39 335 333 438', note: 'Solo emergencias reales (detención, accidente grave, pérdida de documentación urgente).', source: 'https://exteriores.gob.es/Consulados/roma/es/Consulado/Paginas/Horario,-Localizacion-y-Contacto.aspx' },
  { id: 'consulado', label: 'Consulado de España · centralita', phone: '+39 06 6871401', note: 'Via Campo Marzio 34. Lunes a viernes, 9:00–13:00, con cita previa.', source: 'https://exteriores.gob.es/Consulados/roma/es/Consulado/Paginas/Horario,-Localizacion-y-Contacto.aspx' },
  { id: 'hotel', label: 'Hotel Soha Piazza di Spagna', phone: '+39 351 247 3415', note: 'Via Zucchelli 32. Recepción 08:00–16:00.' },
];

export const consulateEmail = 'cog.roma@maec.es';

export const lostDocumentSteps: string[] = [
  'Denunciarlo en la policía (Questura o Carabinieri). Guarda la denuncia en papel y en el móvil.',
  'Avisar al Consulado de España: invalida el documento perdido y, según el caso, da un salvoconducto para volver a España o un pasaporte provisional.',
  'Llevar la denuncia y cualquier copia o foto del DNI o pasaporte que tengas.',
  'Con Ryanair dentro de la UE vale el DNI; sin él, hace falta el documento del consulado.',
];

export const healthCard: string[] = [
  'La Tarjeta Sanitaria Europea da acceso a la sanidad pública italiana en las mismas condiciones que a un italiano.',
  'Llevad la física cada uno. Si no la tenéis a tiempo, se pide el Certificado Provisional Sustitutorio en la sede electrónica de la Seguridad Social.',
];

/** Datos del hotel para enseñar en un taxi o copiar. */
export const hotel = {
  name: 'Hotel Soha Piazza di Spagna',
  addressIt: 'Via Zucchelli 32, Roma',
  taxiIt: 'Via Zucchelli 32, Roma',
  reception: '08:00–16:00',
};
