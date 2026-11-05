import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

export const INDIA_CENTER = [22.6, 79];

// OpenStreetMap tiles, no API key — same source as the backend's public/track.html.
export function BaseMap({ center = INDIA_CENTER, zoom = 5, className = 'h-72', children }) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={`w-full ${className}`} style={{ zIndex: 0 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

// Fits the map to points. `trigger` changes → refit; with `once`, only the first time points exist.
export function FitBounds({ points, trigger = 0, once = false, maxZoom = 15 }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    const valid = (points || []).filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
    if (!valid.length) return;
    if (once && done.current) return;
    done.current = true;
    if (valid.length === 1) map.setView(valid[0], Math.min(maxZoom, 14));
    else map.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, points?.length]);
  return null;
}

// Gives the parent an imperative handle to the Leaflet map.
export function MapRef({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}
