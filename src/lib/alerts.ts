import { itinerary } from '@/data/itinerary';
import { placeById } from '@/data/places';
import { days } from '@/data/trip';
import type { DayKey, DayNum, Place } from '@/data/types';
import { opensOn } from '@/lib/schedule';

export interface Alert {
  id: string;
  level: 'info' | 'warn' | 'danger';
  text: string;
}

const WEEKDAY_NAME: Record<DayKey, string> = { mon: 'lunes', tue: 'martes', wed: 'miércoles', thu: 'jueves', fri: 'viernes', sat: 'sábado', sun: 'domingo' };

/** Sitios de comida, café y helado del itinerario (paradas y planes B). */
export function foodPlaces(): Place[] {
  const ids = new Set<string>();
  for (const s of itinerary) {
    if (s.placeId) ids.add(s.placeId);
    for (const b of s.planB ?? []) ids.add(b.placeId);
  }
  return [...ids]
    .map((id) => placeById.get(id)!)
    .filter((p) => p && ['food', 'cafe', 'gelato', 'bar'].includes(p.kind));
}

/** Avisos fijos de un día del viaje (F04). */
export function dayAlerts(day: DayNum, weekday: DayKey): Alert[] {
  const out: Alert[] = [];
  const info = days.find((d) => d.day === day);
  if (info?.holiday) out.push({ id: `holiday-${day}`, level: 'warn', text: `${info.holiday}: horarios de festivo en tiendas y transporte.` });

  const closed = foodPlaces().filter((p) => opensOn(p, weekday) === false);
  if (closed.length) {
    const names = closed.map((p) => (p.id === 'boccione' && weekday === 'sat' ? `${p.name} (Shabbat)` : p.name));
    out.push({ id: `closed-${day}`, level: 'warn', text: `Cerrado hoy, ${WEEKDAY_NAME[weekday]}: ${names.join(', ')}.` });
  }

  const special: Partial<Record<DayNum, Alert[]>> = {
    1: [{ id: 'trevi-free', level: 'info', text: 'Fontana di Trevi: gratis a partir de las 22:00.' }],
    2: [{ id: 'colosseo-dni', level: 'warn', text: 'Coliseo: la entrada es nominativa. Llevad el DNI.' }],
    3: [
      { id: 'first-sunday', level: 'info', text: "Primer domingo del mes: Palazzo Barberini y Castel Sant'Angelo gratis. Única oportunidad del viaje." },
      { id: 'metro-sunday', level: 'warn', text: 'El metro cierra a las 23:30. Para volver: tranvía 8, taxi o 35–40 min a pie.' },
    ],
    4: [{ id: 'vatican-dress', level: 'warn', text: 'Vaticano: hombros y rodillas cubiertos. Cola a las 07:45.' }],
    5: [{ id: 'early', level: 'danger', text: 'Alarma a las 05:00. Metro a las 05:35; plan B taxi a las 05:45 (tarifa fija 55 €).' }],
  };
  return [...out, ...(special[day] ?? [])];
}
