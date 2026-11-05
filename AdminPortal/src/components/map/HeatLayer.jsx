import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from './leafletGlobal.js';
import 'leaflet.heat';
import { SEQ } from '../charts.jsx';

// leaflet.heat gradient from the sequential orange ramp (light → dark).
export const HEAT_GRADIENT = Object.fromEntries(SEQ.map((c, i) => [Number(((i + 1) / SEQ.length).toFixed(2)), c]));

// points: [{ latitude, longitude, count }], weighted against maxCount.
export function HeatLayer({ points, maxCount, radius = 25 }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return undefined;
    const max = Math.max(maxCount || 1, 1);
    const layer = L.heatLayer(
      points.map((p) => [p.latitude, p.longitude, p.count / max]),
      { radius, blur: Math.round(radius * 0.8), maxZoom: 14, max: 1, minOpacity: 0.25, gradient: HEAT_GRADIENT }
    ).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, maxCount, radius]);
  return null;
}
