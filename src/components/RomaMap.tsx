import { useEffect, useRef } from 'preact/hooks';
import type { Map as MlMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';
import type { LatLng } from '@/lib/geo';
import type { MetroData } from '@/lib/metro-map';
import { ROME_CENTER, STYLE_URL, type Route } from '@/lib/osm';
import { darkenBasemap, localizeLabels } from '@/lib/map-theme';

export type PinKind = 'stop' | 'dot' | 'heart' | 'poi' | 'hotel' | 'found' | 'saved';
export type PinStatus = 'todo' | 'done' | 'now' | 'next';
export interface MapPin { id: string; lat: number; lng: number; kind: PinKind; color: string; short: string; label: string; status?: PinStatus; name?: string; badge?: boolean }

interface Props {
  pins: MapPin[];
  me: LatLng | null;
  route: Route | null;
  /** Rutas alternativas (en gris, se pueden tocar para elegirlas). */
  alts: { i: number; coords: [number, number][] }[];
  onPickAlt: (i: number) => void;
  /** Mapa nocturno (oro sobre oscuro). */
  dark: boolean;
  /** Edificios en 3D y el mapa inclinado. */
  threeD: boolean;
  /** Líneas y estaciones del metro (null = ocultas). */
  metro: MetroData | null;
  /** Recorrido del día en línea de puntos (sin calles) mientras no hay ruta a pie calculada. */
  order: { coords: [number, number][]; color: string } | null;
  /** Cambia cuando hay que reencuadrar (otro día, otro filtro). */
  fitKey: string;
  focus: { lat: number; lng: number; key: number; shiftY?: number } | null;
  /** Rumbo en grados (si el móvil lo da) y modo seguimiento: la cámara te sigue, inclinada y girada hacia donde miras. */
  heading: number | null;
  follow: boolean;
  onPick: (id: string) => void;
  onLongPress: (p: LatLng) => void;
  /** Toque en el mapa vacío (cierra la ficha). */
  onBackground: () => void;
  /** El usuario movió el mapa con el dedo: sale del modo seguimiento. */
  onUserMove: () => void;
  onFail: () => void;
}

const empty = { type: 'FeatureCollection', features: [] } as const;

function heartImage(color: string, edge = '#fff'): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.strokeStyle = edge;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(4, 36, 6, 10, 24, 10);
  g.bezierCurveTo(29, 10, 32, 14, 32, 18);
  g.bezierCurveTo(32, 14, 35, 10, 40, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 56);
  g.closePath();
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, 64, 64);
}

function starImage(): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#E0A526';
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 27 : 12;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](32 + r * Math.cos(a), 33 + r * Math.sin(a));
  }
  g.closePath();
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, 64, 64);
}

function arrowImage(fill = '#4A7FA8'): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = fill;
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(32, 2); g.lineTo(46, 22); g.lineTo(18, 22); g.closePath();
  g.stroke(); g.fill();
  return g.getImageData(0, 0, 64, 64);
}

function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Mapa vectorial interactivo (OpenFreeMap). Se carga bajo demanda: MapLibre pesa ~250 KB comprimido. */
export function RomaMap({ pins, me, route, alts, onPickAlt, dark, threeD, metro, order, fitKey, focus, heading, follow, onPick, onLongPress, onBackground, onUserMove, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ pins, me, route, alts, metro, threeD, order, fitKey, heading, dark });
  latest.current = { pins, me, route, alts, metro, threeD, order, fitKey, heading, dark };
  const pick = useRef(onPick);
  pick.current = onPick;
  const cb = useRef({ onLongPress, onUserMove, onBackground, onPickAlt });
  cb.current = { onLongPress, onUserMove, onBackground, onPickAlt };
  const following = useRef(follow);
  following.current = follow;

  const paint = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { pins: ps, me: pos, route: r, order: ord } = latest.current;
    (m.getSource('pins') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: ps.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, kind: p.kind, color: p.color, short: p.short, status: p.status ?? 'todo', name: p.name ?? '', badge: !!p.badge } })),
    });
    (m.getSource('me') as GeoJSONSource).setData(pos ? { type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }, properties: { heading: latest.current.heading ?? -1 } } : empty);
    (m.getSource('order') as GeoJSONSource).setData(ord && ord.coords.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: ord.coords }, properties: { color: ord.color } } : empty);
    (m.getSource('route') as GeoJSONSource).setData(r ? { type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords }, properties: {} } : empty);
    (m.getSource('alts') as GeoJSONSource).setData({ type: 'FeatureCollection', features: latest.current.alts.map((a) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: a.coords }, properties: { i: a.i } })) });
    const mt = latest.current.metro;
    (m.getSource('metro-lines') as GeoJSONSource).setData(mt ? { type: 'FeatureCollection', features: mt.lines.map((l) => ({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: l.segments }, properties: { color: l.color, ref: l.ref } })) } : empty);
    const colorOf = (ref?: string) => mt?.lines.find((l) => l.ref === ref)?.color ?? '#2B2522';
    (m.getSource('metro-stations') as GeoJSONSource).setData(mt ? { type: 'FeatureCollection', features: mt.stations.map((st) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [st.lng, st.lat] }, properties: { name: st.n, color: colorOf(st.lines[0]), lines: st.lines.join(' ') } })) } : empty);
  };

  const fit = (m: MlMap) => {
    const { pins: ps, me: pos, route: r } = latest.current;
    const pts: [number, number][] = r ? r.coords : [...ps.filter((p) => p.kind !== 'heart' && p.kind !== 'poi' && p.kind !== 'saved').map((p) => [p.lng, p.lat] as [number, number]), ...(pos ? [[pos.lng, pos.lat] as [number, number]] : [])];
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const b: LngLatBoundsLike = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
    m.fitBounds(b, { padding: { top: 84, bottom: 56, left: 40, right: 40 }, maxZoom: 16, duration: 600 });
  };

  useEffect(() => {
    if (!box.current) return;
    if (!webgl()) { onFail(); return; }
    let dead = false;
    let timer = 0;
    void (async () => {
      const [ml] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
      if (dead || !box.current) return;
      const lib = (ml as unknown as { default?: typeof ml }).default ?? ml;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const m = new lib.Map({ container: box.current, style: STYLE_URL, center: [ROME_CENTER.lng, ROME_CENTER.lat], zoom: 13, attributionControl: { compact: true }, cooperativeGestures: false });
      map.current = m;
      if (import.meta.env.DEV || location.search.includes('e2e')) (window as unknown as { __romaMap?: MlMap }).__romaMap = m; // para las pruebas e2e
      m.addControl(new lib.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
      // Solo se cambia al esquema si no llega el ESTILO del mapa. Una tesela, un icono o una letra que fallen
      // (sin conexión, cobertura) no tumban el mapa: se pinta con lo que haya.
      let styleOk = false;
      const dk = latest.current.dark;
      m.on('style.load', () => {
        styleOk = true;
        localizeLabels(m as unknown as Parameters<typeof localizeLabels>[0]);
        if (dk) darkenBasemap(m as unknown as Parameters<typeof darkenBasemap>[0]);
      });
      m.on('error', (e) => {
        if (!ready.current && !styleOk && /style|fetch|Failed|network/i.test(String((e as unknown as { error?: { message?: string } }).error?.message ?? ''))) onFail();
      });
      const init = () => {
        if (ready.current || dead) return;
        ready.current = true;
        window.clearTimeout(timer);
        m.addImage('heart', dk ? heartImage('#E8B4B0', '#17110F') : heartImage('#C0583A'), { pixelRatio: 2 });
        m.addImage('arrow', arrowImage(dk ? '#6FA8DC' : '#4A7FA8'), { pixelRatio: 2 });
        m.addImage('star', starImage(), { pixelRatio: 2 });
        m.addSource('route', { type: 'geojson', data: empty });
        m.addSource('alts', { type: 'geojson', data: empty });
        m.addSource('metro-lines', { type: 'geojson', data: empty });
        m.addSource('metro-stations', { type: 'geojson', data: empty });
        m.addSource('order', { type: 'geojson', data: empty });
        m.addSource('pins', { type: 'geojson', data: empty });
        m.addSource('me', { type: 'geojson', data: empty });
        // Edificios en 3D: sobre las teselas vectoriales que ya están guardadas, por debajo de los rótulos.
        try {
          const st = m.getStyle();
          const vec = Object.entries(st.sources ?? {}).find(([, v]) => (v as { type?: string }).type === 'vector')?.[0];
          const firstLabel = st.layers?.find((l) => l.type === 'symbol')?.id;
          if (vec) m.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: vec, 'source-layer': 'building', minzoom: 14,
            layout: { visibility: latest.current.threeD ? 'visible' : 'none' },
            paint: { 'fill-extrusion-color': dk ? '#3A2D27' : '#E3DAD0', 'fill-extrusion-opacity': 0.88, 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } }, firstLabel);
        } catch { /* sin edificios en 3D: el mapa sigue plano */ }
        m.addLayer({ id: 'metro-casing', type: 'line', source: 'metro-lines', minzoom: 10.5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dk ? '#17110F' : '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 8], 'line-opacity': 0.9 } });
        m.addLayer({ id: 'metro-line', type: 'line', source: 'metro-lines', minzoom: 10.5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5] } });
        m.addLayer({ id: 'metro-station', type: 'circle', source: 'metro-stations', minzoom: 12.5, paint: { 'circle-color': dk ? '#F3E9DD' : '#fff', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 3, 16, 7], 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 } });
        m.addLayer({ id: 'metro-name', type: 'symbol', source: 'metro-stations', minzoom: 14, layout: { 'text-field': ['concat', 'M ', ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-anchor': 'top', 'text-offset': [0, 0.9], 'text-max-width': 8 }, paint: { 'text-color': dk ? '#F3E9DD' : '#2B2522', 'text-halo-color': dk ? '#17110F' : '#fff', 'text-halo-width': 1.8 } });
        m.addLayer({ id: 'alts', type: 'line', source: 'alts', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dk ? '#8F7F73' : '#9AA7B2', 'line-width': 6, 'line-opacity': 0.85 } });
        m.addLayer({ id: 'order-line', type: 'line', source: 'order', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.85, 'line-dasharray': [1.2, 1.8] } });
        m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dk ? '#17110F' : '#fff', 'line-width': 9 } });
        m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dk ? '#E8B95A' : '#4A7FA8', 'line-width': 5 } });
        // Aro suave alrededor de la parada en curso o la siguiente: se ve de un vistazo «por dónde vamos».
        m.addLayer({ id: 'pins-halo', type: 'circle', source: 'pins', filter: ['in', ['get', 'status'], ['literal', ['now', 'next']]],
          paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.28, 'circle-radius': 24 } });
        m.addLayer({ id: 'pins-circle', type: 'circle', source: 'pins', filter: ['in', ['get', 'kind'], ['literal', ['stop', 'dot', 'hotel', 'found', 'poi']]],
          paint: {
            'circle-color': ['case', ['==', ['get', 'status'], 'done'], '#A89F97', ['get', 'color']],
            'circle-radius': ['match', ['get', 'kind'], 'poi', 7, 'dot', 5.5, 'hotel', 13, ['match', ['get', 'status'], 'now', 17, 'next', 17, 14]],
            'circle-stroke-color': '#fff', 'circle-stroke-width': ['match', ['get', 'kind'], 'dot', 1.5, 2.5],
          } });
        m.addLayer({ id: 'pins-hearts', type: 'symbol', source: 'pins', filter: ['==', ['get', 'kind'], 'heart'], layout: { 'icon-image': 'heart', 'icon-size': 0.5, 'icon-allow-overlap': true } });
        m.addLayer({ id: 'pins-saved', type: 'symbol', source: 'pins', filter: ['==', ['get', 'kind'], 'saved'], layout: { 'icon-image': 'star', 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-offset': ['case', ['get', 'badge'], ['literal', [30, -30]], ['literal', [0, 0]]] } });
        m.addLayer({ id: 'pins-label', type: 'symbol', source: 'pins', filter: ['!=', ['get', 'short'], ''],
          layout: { 'text-field': ['get', 'short'], 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'status'], 'now', 16, 'next', 16, 14], 'text-allow-overlap': true, 'text-ignore-placement': true },
          paint: { 'text-color': dk ? '#1B130F' : '#fff' } });
        // Nombre de la parada solo al acercarse: de lejos solo números, para no saturar.
        m.addLayer({ id: 'pins-name', type: 'symbol', source: 'pins', minzoom: 15.2, filter: ['all', ['==', ['get', 'kind'], 'stop'], ['!=', ['get', 'name'], '']],
          layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-anchor': 'top', 'text-offset': [0, 1.5], 'text-max-width': 9 },
          paint: { 'text-color': dk ? '#F3E9DD' : '#2B2522', 'text-halo-color': dk ? '#17110F' : '#fff', 'text-halo-width': 1.8 } });
        m.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-color': dk ? '#6FA8DC' : '#4A7FA8', 'circle-opacity': 0.25, 'circle-radius': 26 } });
        m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', paint: { 'circle-color': dk ? '#6FA8DC' : '#4A7FA8', 'circle-radius': 9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3.5 } });
        // Flecha de rumbo sobre el punto azul: gira con la dirección en la que caminas.
        m.addLayer({ id: 'me-arrow', type: 'symbol', source: 'me', filter: ['>=', ['get', 'heading'], 0],
          layout: { 'icon-image': 'arrow', 'icon-size': 0.5, 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'icon-offset': [0, -22], 'icon-allow-overlap': true } });
        // Pulsación larga (o botón derecho) = marcar un punto cualquiera.
        let press = 0;
        const cancel = () => window.clearTimeout(press);
        m.on('touchstart', (e) => {
          if (e.points && e.points.length > 1) return;
          cancel();
          press = window.setTimeout(() => { navigator.vibrate?.(20); cb.current.onLongPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }); }, 550);
        });
        for (const ev of ['touchend', 'touchmove', 'touchcancel', 'zoomstart', 'rotatestart', 'pitchstart'] as const) m.on(ev, cancel);
        m.on('contextmenu', (e) => cb.current.onLongPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        m.on('dragstart', (e) => { if ((e as unknown as { originalEvent?: unknown }).originalEvent && following.current) cb.current.onUserMove(); });
        m.on('click', (e) => { if (!m.queryRenderedFeatures(e.point, { layers: ['pins-circle', 'pins-hearts', 'pins-saved', 'alts'] }).length) cb.current.onBackground(); });
        m.on('click', 'alts', (e) => { const f = e.features?.[0]; if (f) cb.current.onPickAlt(Number(f.properties.i)); });
        for (const id of ['pins-circle', 'pins-hearts', 'pins-saved', 'alts']) {
          if (id !== 'alts') m.on('click', id, (e) => { const f = e.features?.[0]; if (f) pick.current(String(f.properties.id)); });
          m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
          m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
        }
        paint();
        if (latest.current.threeD) m.setPitch(58);
        fit(m);
      };
      m.on('load', init);
      // Si el estilo está pero alguna tesela no llega, «load» puede tardar: a los 15 s se arranca igual.
      timer = window.setTimeout(() => { if (ready.current) return; if (styleOk) init(); else onFail(); }, 15_000);
    })().catch(() => { if (!dead) onFail(); });
    return () => {
      dead = true;
      window.clearTimeout(timer);
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(paint, [pins, me, route, order, alts, metro]);
  // Edificios en 3D: se enciende la capa y el mapa se inclina; al apagarla vuelve a plano.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (m.getLayer('buildings-3d')) m.setLayoutProperty('buildings-3d', 'visibility', threeD ? 'visible' : 'none');
    if (threeD) m.easeTo({ pitch: 58, zoom: Math.max(m.getZoom(), 15.5), duration: 700 });
    else if (!following.current && m.getPitch() > 0) m.easeTo({ pitch: 0, bearing: 0, duration: 500 });
  }, [threeD]);
  useEffect(() => { if (map.current && ready.current && !follow) fit(map.current); }, [fitKey, route]);
  // Seguimiento: la cámara va contigo, inclinada y mirando hacia donde caminas. Al salir, vuelve a plano y al norte.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (follow && me) m.easeTo({ center: [me.lng, me.lat], zoom: Math.max(m.getZoom(), 17), pitch: 55, bearing: heading ?? m.getBearing(), duration: 700, essential: true });
    else if (!follow && !latest.current.threeD && m.getPitch() > 0) m.easeTo({ pitch: 0, bearing: 0, duration: 500 });
  }, [follow, me?.lat, me?.lng, heading]);
  useEffect(() => { if (focus && map.current && ready.current) map.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.current.getZoom(), 16), duration: 700, offset: [0, -(focus.shiftY ?? 0)] }); }, [focus?.key]);

  return <div ref={box} class="romamap" role="application" aria-label="Mapa de Roma" />;
}
