import { redis } from '../../config/redis.js';
import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../../constants/ride.constants.js';
import { LIVE_STALE_SECONDS } from '../../constants/admin.constants.js';
import { isValidCoordinate } from '../../utils/geo.js';

// Same keys as services/driverLocation.service.js. Read-only here: the admin view never evicts,
// re-parks or otherwise touches dispatch state.
const GEO_KEY = 'drivers:geo';
const metaKey = (driverId) => `driver:meta:${driverId}`;

export class LiveService {
  // Every driver Redis still knows about, with a derived state:
  //   on_trip       online and assigned to an active QuickRide / outstation ride
  //   available     online, fresh fix, not on a ride
  //   disconnected  socket dropped, inside the reconnect grace window (last known position only)
  // Drivers whose meta hash has expired are offline and not returned at all.
  liveDrivers = async () => {
    const ids = await redis.zrange(GEO_KEY, 0, -1);
    if (!ids.length) return [];

    const metas = await redis.pipeline(ids.map((id) => ['hgetall', metaKey(id)])).exec();
    const now = Date.now();
    const found = [];

    ids.forEach((id, i) => {
      const [err, meta] = metas[i];
      if (err || !meta || !Object.keys(meta).length) return;
      const latitude = Number(meta.latitude);
      const longitude = Number(meta.longitude);
      if (!isValidCoordinate(latitude, longitude)) return;
      const updatedAt = Number(meta.updatedAt) || null;
      found.push({
        driverId: id,
        name: meta.name || '',
        vehicleNumber: meta.vehicleNumber || '',
        vehicleTypeId: meta.vehicleTypeId || null,
        latitude,
        longitude,
        isOnline: meta.isOnline === '1',
        updatedAt,
        ageSeconds: updatedAt ? Math.round((now - updatedAt) / 1000) : null,
        disconnectedAt: meta.disconnectedAt ? Number(meta.disconnectedAt) : null,
      });
    });

    if (!found.length) return [];

    const driverIds = found.map((d) => d.driverId);
    const [quick, out] = await Promise.all([
      QuickRide.find({ assignedTo: { $in: driverIds }, rideStatus: { $in: ACTIVE_RIDE_STATUSES } })
        .select('_id assignedTo rideStatus')
        .lean(),
      OutstationRide.find({ assignedTo: { $in: driverIds }, rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES } })
        .select('_id assignedTo rideStatus')
        .lean(),
    ]);
    const rideByDriver = new Map();
    quick.forEach((r) => rideByDriver.set(String(r.assignedTo), { rideId: r._id, rideType: 'quickride', rideStatus: r.rideStatus }));
    // An 'assigned' outstation ride may be days away; it only counts as on-trip once the driver sets off.
    out
      .filter((r) => r.rideStatus !== 'assigned')
      .forEach((r) => rideByDriver.set(String(r.assignedTo), { rideId: r._id, rideType: 'outstation', rideStatus: r.rideStatus }));

    return found.map((d) => {
      const ride = rideByDriver.get(d.driverId) || null;
      let state = 'available';
      if (!d.isOnline) state = 'disconnected';
      else if (ride) state = 'on_trip';
      return { ...d, state, isStale: !d.isOnline || (d.ageSeconds ?? Infinity) > LIVE_STALE_SECONDS, ride };
    });
  };

  liveDriverCounts = async () => {
    try {
      const drivers = await this.liveDrivers();
      const counts = { online: 0, available: 0, onTrip: 0, disconnected: 0 };
      drivers.forEach((d) => {
        if (d.state === 'disconnected') counts.disconnected += 1;
        else {
          counts.online += 1;
          if (d.state === 'on_trip') counts.onTrip += 1;
          else counts.available += 1;
        }
      });
      return counts;
    } catch (error) {
      console.error('[admin] live driver counts unavailable:', error.message);
      return null;
    }
  };

  driverLiveState = async (driverId) => {
    const meta = await redis.hgetall(metaKey(String(driverId)));
    if (!meta || !Object.keys(meta).length) return { state: 'offline' };
    const updatedAt = Number(meta.updatedAt) || null;
    return {
      state: meta.isOnline === '1' ? 'online' : 'disconnected',
      latitude: Number(meta.latitude),
      longitude: Number(meta.longitude),
      updatedAt,
      ageSeconds: updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null,
    };
  };
}
