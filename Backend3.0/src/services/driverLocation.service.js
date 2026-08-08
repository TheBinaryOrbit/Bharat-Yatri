import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { haversineKm, isValidCoordinate } from '../utils/geo.js';

const GEO_KEY = 'drivers:geo';
const metaKey = (driverId) => `driver:meta:${driverId}`;

export class DriverLocationService {
  // Records a driver's position and keeps their metadata alive.
  //
  // Two keys are involved: the GEO sorted set (which cannot expire individual members) and a
  // per-driver hash that DOES expire. The hash's TTL is therefore the liveness signal — a driver
  // whose app died stops refreshing it, and reads treat a missing hash as offline.
  upsertLocation = async ({ driverId, latitude, longitude, meta = {} }) => {
    const id = String(driverId);

    console.log(`[loc] upsert ${id} → ${latitude}, ${longitude}`);

    await redis
      .pipeline()
      .geoadd(GEO_KEY, longitude, latitude, id)
      .hset(metaKey(id), {
        driverId: id,
        latitude: String(latitude),
        longitude: String(longitude),
        isOnline: '1',
        updatedAt: String(Date.now()),
        ...Object.fromEntries(
          Object.entries(meta)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ),
      })
      .expire(metaKey(id), env.DRIVER_LOCATION_TTL_SECONDS)
      .exec();
  };

  getDriverMeta = async (driverId) => {
    const meta = await redis.hgetall(metaKey(String(driverId)));
    return Object.keys(meta).length ? meta : null;
  };

  // Last known position, or null if the driver has gone stale.
  getLastLocation = async (driverId) => {
    const meta = await this.getDriverMeta(driverId);
    if (!meta) return null;

    const latitude = Number(meta.latitude);
    const longitude = Number(meta.longitude);
    if (!isValidCoordinate(latitude, longitude)) return null;

    return { latitude, longitude, at: Number(meta.updatedAt) || null };
  };

  // Deliberate offline — the driver tapped the switch or logged out. Evicted immediately.
  goOffline = async (driverId) => {
    const id = String(driverId);
    await redis.pipeline().zrem(GEO_KEY, id).del(metaKey(id)).exec();
  };

  // The socket dropped without the driver asking to go offline. NOT the same thing as goOffline:
  // a tunnel, a lift or a backgrounded app must not cost the driver their place in the index.
  //
  // The entry is parked instead of deleted — flagged offline so dispatch skips it (there is no
  // socket to deliver a ride to anyway) and given a long grace TTL to come back to. Returns false
  // if there was nothing to park, i.e. the driver never went online.
  beginDisconnectGrace = async (driverId) => {
    const id = String(driverId);
    const key = metaKey(id);

    if (!(await redis.exists(key))) return false;

    await redis
      .pipeline()
      .hset(key, { isOnline: '0', disconnectedAt: String(Date.now()) })
      .expire(key, env.DRIVER_DISCONNECT_GRACE_SECONDS)
      .exec();

    return true;
  };

  // Reconnected inside the grace window. The parked entry is reinstated with the vehicle metadata
  // it already holds, so the app resumes pinging without walking the driver back through
  // driver:online. Returns the recovered meta, or null if the window closed and they must re-online.
  resumeFromGrace = async (driverId) => {
    const id = String(driverId);
    const meta = await this.getDriverMeta(id);

    if (!meta || meta.isOnline === '1') return null;

    await redis
      .pipeline()
      .hset(metaKey(id), { isOnline: '1', updatedAt: String(Date.now()) })
      .hdel(metaKey(id), 'disconnectedAt')
      .expire(metaKey(id), env.DRIVER_LOCATION_TTL_SECONDS)
      .exec();

    return meta;
  };

  // Rejects a fix that would require the driver to have moved impossibly fast since their last one.
  // Catches GPS glitches and crude location spoofing; a driver with no previous fix always passes.
  isPlausibleJump = async (driverId, latitude, longitude) => {
    const last = await this.getLastLocation(driverId);
    if (!last?.at) return true;

    const hours = (Date.now() - last.at) / 3_600_000;
    if (hours <= 0) return true;

    const km = haversineKm(last, { latitude, longitude });
    const kmph = km / hours;

    console.log(
      `[loc] jump check ${driverId}: ${last.latitude}, ${last.longitude} → ${latitude}, ${longitude}` +
        ` = ${km.toFixed(3)}km in ${(hours * 3600).toFixed(1)}s (${kmph.toFixed(1)} km/h, limit ${env.MAX_LOCATION_JUMP_KMPH})`
    );

    return kmph <= env.MAX_LOCATION_JUMP_KMPH;
  };

  // Drivers within radiusKm of a point, nearest first, restricted to a vehicle type.
  //
  // GEO members outlive their metadata hash, so anyone whose hash has expired is treated as
  // offline and lazily evicted from the set — otherwise a driver who force-quit would stay
  // "nearby" forever.
  findNearbyDrivers = async ({ latitude, longitude, radiusKm, vehicleTypeId }) => {
    const hits = await redis.geosearch(
      GEO_KEY,
      'FROMLONLAT',
      longitude,
      latitude,
      'BYRADIUS',
      radiusKm,
      'km',
      'ASC',
      'WITHDIST'
    );

    if (!hits.length) return [];

    const ids = hits.map(([id]) => id);
    const metas = await redis.pipeline(ids.map((id) => ['hgetall', metaKey(id)])).exec();

    const stale = [];
    const drivers = [];

    hits.forEach(([id, distance], i) => {
      const [err, meta] = metas[i];
      if (err || !meta || !Object.keys(meta).length) {
        stale.push(id);
        return;
      }
      if (vehicleTypeId && String(meta.vehicleTypeId) !== String(vehicleTypeId)) return;
      if (meta.isOnline !== '1') return;

      drivers.push({ ...meta, driverId: id, distanceKm: Number(distance) });
    });

    if (stale.length) await redis.zrem(GEO_KEY, ...stale);

    return drivers;
  };

  // Widens the search ring until it finds drivers, or runs out of radius.
  //
  // `filter` is injected rather than applied by the caller afterwards: a 2km ring full of busy
  // drivers must widen to 4km, not end the search with an empty result.
  //
  // `radius` overrides the QuickRide envs. Outstation passes start = max = step, which makes this
  // a single fixed sweep — the loop body runs exactly once. Deliberate: the ring exists to find
  // the NEAREST driver in seconds, and it returns at the first non-empty radius, so on a 450km
  // trip it would push to the three drivers inside 2km and never tell the forty at 15km.
  // Outstation is chosen on bid price, not proximity, so a small bid pool is a loss to the rider.
  findNearbyDriversExpanding = async ({ latitude, longitude, vehicleTypeId, filter, radius = null }) => {
    const startKm = radius?.startKm ?? env.DRIVER_SEARCH_RADIUS_START_KM;
    const maxKm = radius?.maxKm ?? env.DRIVER_SEARCH_RADIUS_MAX_KM;
    const stepKm = radius?.stepKm ?? env.DRIVER_SEARCH_RADIUS_STEP_KM;

    for (let radiusKm = startKm; radiusKm <= maxKm; radiusKm += stepKm) {
      const found = await this.findNearbyDrivers({ latitude, longitude, radiusKm, vehicleTypeId });
      const eligible = filter ? await filter(found) : found;

      if (eligible.length) return { drivers: eligible, radiusKm };
    }

    return { drivers: [], radiusKm: maxKm };
  };
}
