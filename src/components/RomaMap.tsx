import { useEffect, useRef } from 'preact/hooks';
import type { Map as MlMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';
import type { LatLng } from '@/lib/geo';
import { ROME_CENTER, STYLE_URL, type Route } from '@/lib/osm';

export type PinKind = 'stop' | 'heart' | 'poi' | 'hotel' | 'found';
export interface MapPin { id: string; lat: number; lng: number; kind: PinKind; color: string; short: string; label: string }

interface Props {
  pins: MapPin[];
  me: LatLng | null;
  route: Route | null;
  /** Cambia cuando hay que reencuadrar (otro día, otro filtro). */
  fitKey: string;
  focus: { lat: number; lng: number; key: number } | null;
  onPick: (id: string) => void;
  onFail: () => void;
}

const empty = { type: 'FeatureCollection', features: [] } as const;

function heartImage(color: string): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.strokeStyle = '#fff';
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

function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Mapa vectorial interactivo (OpenFreeMap). Se carga bajo demanda: MapLibre pesa ~250 KB comprimido. */
export function RomaMap({ pins, me, route, fitKey, focus, onPick, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ pins, me, route, fitKey });
  latest.current = { pins, me, route, fitKey };
  const pick = useRef(onPick);
  pick.current = onPick;

  const paint = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { pins: ps, me: pos, route: r } = latest.current;
    (m.getSource('pins') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: ps.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, kind: p.kind, color: p.color, short: p.short } })),
    });
    (m.getSource('me') as GeoJSONSource).setData(pos ? { type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }, properties: {} } : empty);
    (m.getSource('route') as GeoJSONSource).setData(r ? { type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords }, properties: {} } : empty);
  };

  const fit = (m: MlMap) => {
    const { pins: ps, me: pos, route: r } = latest.current;
    const pts: [number, number][] = r ? r.coords : [...ps.filter((p) => p.kind !== 'heart').map((p) => [p.lng, p.lat] as [number, number]), ...(pos ? [[pos.lng, pos.lat] as [number, number]] : [])];
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const b: LngLatBoundsLike = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
    m.fitBounds(b, { padding: { top: 50, bottom: 50, left: 40, right: 40 }, maxZoom: 16, duration: 600 });
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
      m.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
      timer = window.setTimeout(() => { if (!ready.current) onFail(); }, 15_000);
      m.on('error', (e) => {
        // Sin red y sin mapa descargado: el estilo no llega y volvemos al esquema.
        if (!ready.current && /style|fetch|Failed|network/i.test(String((e as unknown as { error?: { message?: string } }).error?.message ?? ''))) onFail();
      });
      m.on('load', () => {
        ready.current = true;
        window.clearTimeout(timer);
        m.addImage('heart', heartImage('#C0583A'), { pixelRatio: 2 });
        m.addSource('route', { type: 'geojson', data: empty });
        m.addSource('pins', { type: 'geojson', data: empty });
        m.addSource('me', { type: 'geojson', data: empty });
        m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 9 } });
        m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#4A7FA8', 'line-width': 5 } });
        m.addLayer({ id: 'pins-circle', type: 'circle', source: 'pins', filter: ['in', ['get', 'kind'], ['literal', ['stop', 'hotel', 'found', 'poi']]],
          paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['match', ['get', 'kind'], 'poi', 7, 'hotel', 12, 11], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
        m.addLayer({ id: 'pins-hearts', type: 'symbol', source: 'pins', filter: ['==', ['get', 'kind'], 'heart'], layout: { 'icon-image': 'heart', 'icon-size': 0.55, 'icon-allow-overlap': true } });
        m.addLayer({ id: 'pins-label', type: 'symbol', source: 'pins', filter: ['!=', ['get', 'short'], ''],
          layout: { 'text-field': ['get', 'short'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
          paint: { 'text-color': '#fff' } });
        m.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-color': '#4A7FA8', 'circle-opacity': 0.22, 'circle-radius': 20 } });
        m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', paint: { 'circle-color': '#4A7FA8', 'circle-radius': 8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
        for (const id of ['pins-circle', 'pins-hearts']) {
          m.on('click', id, (e) => { const f = e.features?.[0]; if (f) pick.current(String(f.properties.id)); });
          m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
          m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
        }
        paint();
        fit(m);
      });
    })().catch(() => { if (!dead) onFail(); });
    return () => {
      dead = true;
      window.clearTimeout(timer);
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(paint, [pins, me, route]);
  useEffect(() => { if (map.current && ready.current) fit(map.current); }, [fitKey, route]);
  useEffect(() => { if (focus && map.current && ready.current) map.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.current.getZoom(), 16), duration: 700 }); }, [focus?.key]);

  return <div ref={box} class="romamap" role="application" aria-label="Mapa de Roma" />;
}
