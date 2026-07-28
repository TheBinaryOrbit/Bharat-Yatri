const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in km between two { latitude, longitude } points.
export const haversineKm = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

// True only for a usable WGS84 coordinate pair. Rejects NaN, Infinity, strings and out-of-range values.
export const isValidCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

// Mongo/GeoJSON stores [longitude, latitude]; the apps speak { latitude, longitude }.
// These two helpers are the only place that ordering is written down.
export const toGeoPoint = (latitude, longitude) => ({
  type: 'Point',
  coordinates: [longitude, latitude],
});

export const fromGeoPoint = (point) => {
  if (!point?.coordinates?.length) return null;
  const [longitude, latitude] = point.coordinates;
  return { latitude, longitude };
};
