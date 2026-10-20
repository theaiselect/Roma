# Roma — traspaso para seguir en otra conversación

Última actualización: 19 oct 2026 (commit a7160f6). Sin secretos: el código del viaje es la fecha que Jesús y Lucía conocen.

## Qué es
PWA «Roma» para el viaje de Jesús y Lucía a Roma (vie 30 oct – mar 3 nov 2026). Jesús: Android (S23 Ultra). Lucía: iPhone. Idioma de la app y de la conversación: español.
- Producción: https://roma-rho-eight.vercel.app (proyecto Vercel «roma», equipo theaiselect1, plan Hobby)
- Repo: github.com/theaiselect/Roma (push a `main` despliega solo). Local en la sesión: /home/claude/roma
- Estado del servidor: `/api/health` → `{ok, tripCode, redis, blob}` los cuatro en true (comprobado 19 oct).

## Objetivos permanentes del usuario
- «Tiene que funcionar todo». Mapa «como Google Maps o mejor». APIs gratuitas sin clave permitidas. Nada de tarjeta ni pagos.
- Lo que falle offline debe poder hacerse offline (hecho salvo sincronizar con Lucía y abrir cartas/cápsula, que son del servidor a propósito).
- Cenas a horario español (21:00–23:00).

## Stack
Vite 8 · Preact 11 + preact-iso · TypeScript · vite-plugin-pwa (injectManifest) · IndexedDB (idb, stores `meta`, `blobs`, entidades) · sync local-first con Upstash Redis (api/) · Vercel Blob (api/blob.ts, con OIDC: basta BLOB_STORE_ID; token opcional vía api/_blobToken.ts) · MapLibre 6.15 + OpenFreeMap + OSRM foot (routing.openstreetmap.de) + Photon + Overpass.
Auth: cabecera `x-trip-code` (api/_auth.ts normaliza: minúsculas, sin espacios, puntos, guiones ni barras).

## Módulos clave
- `src/lib/osm.ts`: rutas/búsqueda/reverse/POIs. Online primero (timeouts cortos) y, si no hay red, cae a lo guardado.
- `src/lib/graph.ts`: grafo peatonal CSR desde Overpass, snap, A*, pasos en español (reusa `nav.ts`).
- `src/lib/offline-data.ts`: descargas (calles 3×3 trozos, sitios 2×2, POIs, tiempo, archivos), índice de búsqueda, reverse offline, `prepareOffline`, `offlineStatus`.
- `src/lib/offline-map.ts`: teselas a caché `mapa`. `src/components/OfflineCard.tsx`: botón «Preparar para ir sin conexión» + lista de lo descargado.
- `src/lib/nav.ts`, `speech.ts`, `geo.ts`: navegación giro a giro, voz, GPS.
- `src/data/*`: itinerario, lugares (con horarios), reservas, emergencias, hotel (`trip.ts`).
- Hoy: `screens/Today.tsx` + `today-extras.tsx` (incluye «Hoy cierran…»).

## Datos del viaje confirmados
- Hotel: Soha Piazza di Spagna Boutique, Via Zucchelli 32 (1.º con ascensor), tel +39 351 247 3415. Booking: entrada vie 30 desde 14:00, salida mar 3 de 08:00 a 11:00. Cancelación gratis hasta 26 oct 23:59. Referencia y PIN están en la app (Emergencias).
- Lucía llega a Termini a las 11:45 el 30; quedan en **Termini**.
- Vuelos: Sevilla→Fiumicino 30 oct 9:30; Fiumicino→Madrid 3 nov 9:00. Alarma 05:00 el martes; metro 05:35; recepción del hotel cerrada de noche (pedir cómo dejar la llave).
- Entradas: Panteón comprado (lun 2, 15:00–16:00). Coliseo: van a por Full Experience Arena el sáb 31. Galleria Borghese agotada → plan B Palazzo Barberini (dom 1).
- Cenas (horas en el plan): vie Peroni 21:00 · sáb Felice a Testaccio 21:00 · dom Ai Marmi 21:00 · lun Taverna dei Fori Imperiali 20:30.

## Pendiente (del usuario)
- Reservar: Felice (+39 06 574 6800), Taverna (+39 06 679 8643), Museos Vaticanos lun 2 a las 8:00 (1 Intero + 1 Ridotto, ~40 €).
- Billete Madrid→Plasencia (3 nov): aún no comprado.
- Mensaje al hotel (mochilas el viernes, llave el martes, tasa turística).
- «Sorpasso»: restaurante que aparece solo en la auditoría original (domingo cerrado); no está en los datos. Preguntar si lo quieren y añadir con horario real.

## Pendiente (de la app) / sin verificar
- Probar en móviles reales: subir foto/entrada y verla en el otro móvil; «Preparar para ir sin conexión» con wifi y probar en modo avión; voz de navegación; instalación en iPhone; PDF del libro; botones de compartir; cápsula del tiempo.
- Servicios reales (OpenFreeMap, OSRM, Photon, Overpass) solo probados con simulaciones: el entorno de pruebas no tiene internet.
- Pantallas mejoradas a fondo (fase 4): Plan (resumen del día, casilla «hecho» en cada parada con lista `stops`, estado de la entrada por parada, día anterior/siguiente), Reservas (resumen, grupos, «Ya está hecho», nota propia en lista `resnotes`, visor de entradas a pantalla completa `TicketViewer`/`lib/ticket-view.ts`), Diario (guarda solo lo cambiado y al salir, varias notas de voz), Cartas (editar antes de abrir, se desbloquean con la pantalla abierta), Votos (resumen de coincidencias, día futuro bloqueado), Postal (3 estilos, vista previa automática), Canción (una por persona y día, cualquier enlace https), Libro (archivo HTML autónomo con fotos, `lib/book.ts`), Ajustes («Probar conexión y código», «Buscar versión nueva», descarga sin conexión).
- Pruebas: `tests/unit/phase4.test.ts` y `e2e/screens.py` (servidor e2e recién arrancado en :5199; reiniciarlo con `kill $(lsof -ti tcp:5199)` antes de cada suite que escribe estado).
- Fase 5 (20 oct): aviso de reservas por hacer en Hoy (`OpenReservationsCard`, `openReservations`), previsión de los 5 días del viaje antes de empezar (`TripForecast`, Open-Meteo da 16 días), sugerencia de plan de lluvia cuando la previsión da lluvia (`RainSuggestion`, `rainSuggested`), recordatorio de copia de seguridad (`lib/backup-reminder.ts`, fecha de la última copia en `localStorage` `roma-last-backup`, sale en Hoy y en Ajustes `#copia`), Emergencias con «Nuestro hotel» (enseñar al taxista) y «Mi ficha» (solo local, `roma-my-card`), Frases con grupo «Hotel y taxi» y favoritas (`roma-fav-phrases`). Datos solo locales en `lib/local.ts`. Pruebas: `tests/unit/phase5.test.ts`, `e2e/extras.py`.
- Mapa rehecho (20 oct): pines numerados 1, 2, 3… por día en orden de ruta (`lib/map-stops.ts`: `buildDayStops`, estados hecho/ahora/siguiente), «Todos» = solo puntos de color, ficha sobre el mapa al tocar un número (`components/StopSheet.tsx`: qué hacemos, hora y «en N min», entrada, horario, tiempo, atardecer, distancia, carta que se abre ahí, «Marcar como hecho», anterior/siguiente), chip «Siguiente/Ahora» sobre el mapa, línea de puntos con el orden y recorrido a pie del día calculado solo (`dayPath`), posición en vivo y «Centrar en mí» (se localiza solo si ya diste permiso), estilo OpenFreeMap **positron** (más limpio; si el offline ya estaba guardado con liberty, se vuelve a bajar solo), momento «Habéis llegado» con corazones y frase cariñosa a <45 m de una parada de hoy (`ArrivalMoment`, `HeartBurst`).
- Offline AUTOMÁTICO (`lib/auto-offline.ts`, `components/OfflineBanner.tsx`): a los 3,5 s de abrir la app con conexión baja mapa, calles, sitios, puntos y archivos que falten o tengan >14 días (mapa >30), pide almacenamiento persistente, reintenta 3 veces cada 5 min, y con datos móviles/ahorro de datos espera a la wifi («Guardar ya» lo fuerza). En pruebas automáticas (navigator.webdriver) no arranca salvo `?autooffline=1`. iPhone: solo la app instalada en pantalla de inicio conserva la caché de forma fiable.
- Fase de rediseño visual pendiente (orden acordado: primero funcionar, luego bonito).

## Cómo probar
- `npx tsc --noEmit -p . && npx vitest run` (158 tests)
- e2e Python Playwright (chromium en /opt/pw-browsers/chromium): servidor e2e `npx vite --config vite.e2e.config.ts --port 5199` (en memoria: **reiniciar para cada suite que escribe estado**, p. ej. sync.py y tools.py); preview de producción `npx vite build && npx vite preview --port 5188` para `BASE=http://127.0.0.1:5188 python3 e2e/map.py`.
- No matar procesos por nombre (`pkill -f`): ha tumbado el shell dos veces.
- `/api/health`: WebFetch cachea 15 min por URL, usar `?check=N`.

## Vercel
El MCP de Vercel no puede acceder al proyecto (403): los redeploy los hace el usuario a mano. Las variables de entorno solo aplican a despliegues nuevos. Blob: el almacén es `amor-roma-archivos` (privado), conectado a `roma`.
