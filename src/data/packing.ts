import type { DayNum } from './types';

// Maleta (F34) y lista de la noche anterior (F35). Casillas compartidas por persona.
export interface PackItem { id: string; text: string; note?: string }

export const packing: PackItem[] = [
  { id: 'mochila', text: 'Mochila de 40×30×20 cm (la única pieza de equipaje)', note: 'Es lo que incluye la tarifa de Ryanair sin maleta de cabina extra.' },
  { id: 'dni', text: 'DNI en vigor' },
  { id: 'tse', text: 'Tarjeta Sanitaria Europea' },
  { id: 'carnet', text: 'Carnet de estudiante (descuentos)' },
  { id: 'liquidos', text: 'Líquidos en envases de 100 ml máximo, en bolsa transparente de 1 L' },
  { id: 'cargador', text: 'Cargador del móvil' },
  { id: 'bateria', text: 'Batería externa, siempre en cabina (nunca facturada)' },
  { id: 'adaptador', text: 'Adaptador de enchufe', note: 'En Italia hay enchufes tipo F (como en España) y tipo L; uno para L no sobra.' },
  { id: 'calzado', text: 'Calzado cómodo ya usado' },
  { id: 'vaticano', text: 'Ropa que cubra hombros y rodillas (lunes, Basílica de San Pedro)' },
  { id: 'abrigo', text: 'Chaqueta para la noche y algo para la lluvia' },
  { id: 'efectivo', text: 'Algo de efectivo (Regoli, Boccione y propinas)' },
  { id: 'halloween', text: 'Algo para la noche de Halloween (sábado)' },
  { id: 'botella', text: 'Botella reutilizable para las fuentes (nasoni)' },
];

export interface NightItem { id: string; text: string; /** Día del viaje al que prepara (se muestra la noche anterior). */ forDay?: DayNum }

export const nightBefore: NightItem[] = [
  { id: 'alarma', text: 'Alarma puesta' },
  { id: 'cargar', text: 'Móvil y batería externa cargando' },
  { id: 'entradas', text: 'Entradas de mañana añadidas y abiertas una vez en la app' },
  { id: 'checkin-ida', text: 'Check-in online de Ryanair y tarjeta de embarque en myRyanair', forDay: 1 },
  { id: 'bus', text: 'Billete del bus Plasencia → Sevilla a mano (sale a las 03:05)', forDay: 1 },
  { id: 'uber', text: 'Uber Reserve de las 07:40 confirmado', forDay: 1 },
  { id: 'dni-coliseo', text: 'DNI a mano para el Coliseo', forDay: 2 },
  { id: 'efectivo-regoli', text: 'Efectivo para Regoli', forDay: 2 },
  { id: 'ropa-vaticano', text: 'Ropa que cubra hombros y rodillas para San Pedro', forDay: 4 },
  { id: 'checkout-lunes', text: 'Despertador para el check-out en recepción a las 08:45', forDay: 4 },
  { id: 'mochilas', text: 'Mochilas hechas', forDay: 5 },
  { id: 'checkin-vuelta', text: 'Check-in de Ryanair de vuelta y tarjeta de embarque', forDay: 5 },
  { id: 'hotel-salida', text: 'Check-out hecho y sabido dónde dejar la llave (salís a las 05:30 con la recepción cerrada)', forDay: 5 },
];
