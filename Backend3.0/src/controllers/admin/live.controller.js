import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { VehicleType } from '../../models/vehicleType.model.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../../constants/ride.constants.js';
import { LiveService } from '../../services/admin/live.service.js';
import { env } from '../../config/env.js';
import { badRequest, dateFilter, handle, isId, maskPerson, toId } from './helpers.js';
import { defaultRange } from './metrics.js';

const liveService = new LiveService();

const rideCard = (r, rideType, positions) => {
  const pos = r.assignedTo ? positions.get(String(r.assignedTo._id ?? r.assignedTo)) : null;
  return {
    _id: r._id,
    rideType,
    rideStatus: r.rideStatus,
    pickupLocationName: r.pickupLocationName,
    dropLocationName: r.dropLocationName,
    pickup: { longitude: r.pickupCoordinates?.coordinates?.[0], latitude: r.pickupCoordinates?.coordinates?.[1] },
    drop: { longitude: r.dropCoordinates?.coordinates?.[0], latitude: r.dropCoordinates?.coordinates?.[1] },
    offeredFare: r.offeredFare,
    finalFare: r.finalFare,
    pickupAt: r.pickupAt ?? null,
    createdAt: r.createdAt,
    vehicleType: r.vehicleTypeId ? { _id: r.vehicleTypeId._id, name: r.vehicleTypeId.name } : null,
    customer: r.bookedBy ? { _id: r.bookedBy._id, name: r.bookedBy.name, phoneNumber: r.bookedBy.phoneNumber } : null,
    driver: r.assignedTo ? { _id: r.assignedTo._id, name: r.assignedTo.name, phoneNumber: r.assignedTo.phoneNumber } : null,
    driverPosition: pos
      ? { latitude: pos.latitude, longitude: pos.longitude, updatedAt: pos.updatedAt, ageSeconds: pos.ageSeconds, isStale: pos.isStale }
      : null,
  };
};

// Buckets points into a lat/lng grid. cellDeg 0.01 ≈ 1.1 km.
const grid = (points, cellDeg) => {
  const cells = new Map();
  points.forEach(({ latitude, longitude, weight = 1 }) => {
    const la = Math.round(latitude / cellDeg) * cellDeg;
    const lo = Math.round(longitude / cellDeg) * cellDeg;
    const key = `${la.toFixed(5)},${lo.toFixed(5)}`;
    const cell = cells.get(key) || { latitude: Number(la.toFixed(5)), longitude: Number(lo.toFixed(5)), count: 0 };
    cell.count += weight;
    cells.set(key, cell);
  });
  return [...cells.values()];
};

const readCell = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.002 && n <= 0.5 ? n : 0.01;
};

export class LiveController {
  // GET /admin/live/drivers?vehicleTypeId&state
  drivers = handle('load live drivers', async (req, res) => {
    let drivers = await liveService.liveDrivers();
    if (req.query.vehicleTypeId) drivers = drivers.filter((d) => d.vehicleTypeId === String(req.query.vehicleTypeId));
    if (req.query.state) drivers = drivers.filter((d) => d.state === req.query.state);

    const types = await VehicleType.find().select('name').lean();
    const typeName = new Map(types.map((t) => [String(t._id), t.name]));

    return res.status(200).json({
      generatedAt: Date.now(),
      staleAfterSeconds: env.DRIVER_LOCATION_TTL_SECONDS,
      data: drivers.map((d) => ({ ...d, vehicleTypeName: typeName.get(d.vehicleTypeId) || null })),
    });
  });

  // GET /admin/live/rides?rideType=quickride|outstation&includeSearching=true
  rides = handle('load live rides', async (req, res) => {
    const { rideType } = req.query;
    const includeSearching = req.query.includeSearching !== 'false';
    const quickStatuses = includeSearching ? ['searching', ...ACTIVE_RIDE_STATUSES] : ACTIVE_RIDE_STATUSES;
    const outStatuses = includeSearching ? ['searching', ...OUTSTATION_ACTIVE_RIDE_STATUSES] : OUTSTATION_ACTIVE_RIDE_STATUSES;

    const populate = (q) =>
      q
        .populate('bookedBy', 'name phoneNumber')
        .populate('assignedTo', 'name phoneNumber')
        .populate('vehicleTypeId', 'name')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

    const [quick, out, drivers] = await Promise.all([
      rideType === 'outstation' ? [] : populate(QuickRide.find({ rideStatus: { $in: quickStatuses } })),
      rideType === 'quickride' ? [] : populate(OutstationRide.find({ rideStatus: { $in: outStatuses } })),
      liveService.liveDrivers(),
    ]);
    const positions = new Map(drivers.map((d) => [d.driverId, d]));

    const data = [...quick.map((r) => rideCard(r, 'quickride', positions)), ...out.map((r) => rideCard(r, 'outstation', positions))];
    data.forEach((r) => {
      maskPerson(req, r.customer);
      maskPerson(req, r.driver);
    });
    return res.status(200).json({ generatedAt: Date.now(), data });
  });

  // GET /admin/heatmap/supply?vehicleTypeId&state&cell — live driver density, no identities
  supply = handle('build supply heatmap', async (req, res) => {
    let drivers = await liveService.liveDrivers();
    if (req.query.vehicleTypeId) drivers = drivers.filter((d) => d.vehicleTypeId === String(req.query.vehicleTypeId));
    if (req.query.state) drivers = drivers.filter((d) => d.state === req.query.state);
    const cellDeg = readCell(req.query.cell);
    const cells = grid(drivers, cellDeg);
    return res.status(200).json({
      mode: 'supply',
      generatedAt: Date.now(),
      cellDeg,
      totalDrivers: drivers.length,
      maxCount: cells.reduce((m, c) => Math.max(m, c.count), 0),
      data: cells,
      note: 'Current positions only — driver location history is not stored.',
    });
  });

  // GET /admin/heatmap/demand?from&to&rideType&vehicleTypeId&cell — where rides were requested
  demand = handle('build demand heatmap', async (req, res) => {
    const errors = [];
    const range = defaultRange(dateFilter(req.query, errors));
    if (errors.length) return badRequest(res, errors);
    const cellDeg = readCell(req.query.cell);

    const match = { createdAt: range };
    if (isId(req.query.vehicleTypeId)) match.vehicleTypeId = toId(req.query.vehicleTypeId);
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            lo: { $multiply: [{ $round: [{ $divide: [{ $arrayElemAt: ['$pickupCoordinates.coordinates', 0] }, cellDeg] }, 0] }, cellDeg] },
            la: { $multiply: [{ $round: [{ $divide: [{ $arrayElemAt: ['$pickupCoordinates.coordinates', 1] }, cellDeg] }, 0] }, cellDeg] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5000 },
    ];
    const [quick, out] = await Promise.all([
      req.query.rideType === 'outstation' ? [] : QuickRide.aggregate(pipeline),
      req.query.rideType === 'quickride' ? [] : OutstationRide.aggregate(pipeline),
    ]);
    const merged = grid(
      [...quick, ...out].map((c) => ({ latitude: c._id.la, longitude: c._id.lo, weight: c.count })),
      cellDeg
    );
    return res.status(200).json({
      mode: 'demand',
      range: { from: range.$gte, to: range.$lte },
      cellDeg,
      totalRides: merged.reduce((s, c) => s + c.count, 0),
      maxCount: merged.reduce((m, c) => Math.max(m, c.count), 0),
      data: merged,
    });
  });
}
