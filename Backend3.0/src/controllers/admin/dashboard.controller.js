import { User } from '../../models/user.model.js';
import { Driver } from '../../models/driver.model.js';
import { Vehicle } from '../../models/vehicle.model.js';
import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { QuickRideBid } from '../../models/quickRideBid.model.js';
import { OutstationRideBid } from '../../models/outstationRideBid.model.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../../constants/ride.constants.js';
import { badRequest, dateFilter, handle } from './helpers.js';
import { countBy, dayKey, daysBetween, defaultRange, TZ } from './metrics.js';
import { LiveService } from '../../services/admin/live.service.js';

const liveService = new LiveService();

const statusCounts = (Model, match = {}) =>
  Model.aggregate([{ $match: match }, { $group: { _id: '$rideStatus', count: { $sum: 1 } } }]).then(countBy);

// Ride value = what riders agreed to pay on completed rides. NOT platform revenue (admin.md §5.1).
const rideValue = (Model, match = {}) =>
  Model.aggregate([
    { $match: { ...match, rideStatus: 'completed', finalFare: { $ne: null } } },
    { $group: { _id: null, value: { $sum: '$finalFare' }, rides: { $sum: 1 } } },
  ]).then((r) => ({ value: r[0]?.value ?? 0, rides: r[0]?.rides ?? 0 }));

const daily = (Model, match, extraGroup = {}) =>
  Model.aggregate([
    { $match: match },
    { $group: { _id: dayKey(), count: { $sum: 1 }, ...extraGroup } },
  ]);

export class DashboardController {
  // GET /admin/dashboard/summary?from&to   (range defaults to last 30 days)
  summary = handle('load dashboard', async (req, res) => {
    const errors = [];
    const range = defaultRange(dateFilter(req.query, errors));
    if (errors.length) return badRequest(res, errors);
    const inRange = { createdAt: range };

    const [
      customers, customersBlocked, customersNew,
      drivers, driversBlocked, driversNew, kycByStatus, kycPendingManual, onboardingComplete,
      vehicles,
      quickAll, outAll, quickRange, outRange,
      quickValue, outValue,
      quickBidsLive, outBidsLive,
      live,
    ] = await Promise.all([
      User.estimatedDocumentCount(),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments(inRange),
      Driver.estimatedDocumentCount(),
      Driver.countDocuments({ isBlocked: true }),
      Driver.countDocuments(inRange),
      Driver.aggregate([{ $group: { _id: '$kycStatus', count: { $sum: 1 } } }]).then(countBy),
      Driver.countDocuments({ kycMethod: 'manual', kycStatus: 'pending' }),
      Driver.countDocuments({ isProfileComplete: true }),
      Vehicle.estimatedDocumentCount(),
      statusCounts(QuickRide),
      statusCounts(OutstationRide),
      statusCounts(QuickRide, inRange),
      statusCounts(OutstationRide, inRange),
      rideValue(QuickRide, inRange),
      rideValue(OutstationRide, inRange),
      QuickRideBid.countDocuments({ requestStatus: 'pending' }),
      OutstationRideBid.countDocuments({ requestStatus: 'pending' }),
      liveService.liveDriverCounts(),
    ]);

    const sum = (o) => Object.values(o).reduce((s, n) => s + n, 0);
    const ongoingQuick = ACTIVE_RIDE_STATUSES.reduce((s, k) => s + (quickAll[k] || 0), 0);
    const ongoingOut = OUTSTATION_ACTIVE_RIDE_STATUSES.reduce((s, k) => s + (outAll[k] || 0), 0);

    return res.status(200).json({
      range: { from: range.$gte, to: range.$lte, timezone: TZ },
      customers: { total: customers, blocked: customersBlocked, newInRange: customersNew },
      drivers: {
        total: drivers,
        blocked: driversBlocked,
        newInRange: driversNew,
        onboardingComplete,
        kyc: {
          verified: kycByStatus.verified || 0,
          pending: kycByStatus.pending || 0,
          rejected: kycByStatus.rejected || 0,
          notStarted: (kycByStatus.not_started || 0) + (kycByStatus.unknown || 0),
        },
        pendingManualKyc: kycPendingManual,
        live,
      },
      vehicles: { total: vehicles },
      quickRides: { total: sum(quickAll), byStatus: quickAll, inRange: sum(quickRange), inRangeByStatus: quickRange, ongoing: ongoingQuick },
      outstationRides: { total: sum(outAll), byStatus: outAll, inRange: sum(outRange), inRangeByStatus: outRange, ongoing: ongoingOut, scheduled: outAll.assigned || 0 },
      rideValue: { quick: quickValue, outstation: outValue, total: quickValue.value + outValue.value },
      bids: { liveQuick: quickBidsLive, liveOutstation: outBidsLive },
    });
  });

  // GET /admin/dashboard/timeseries?from&to — one row per IST day
  timeseries = handle('load dashboard charts', async (req, res) => {
    const errors = [];
    const range = defaultRange(dateFilter(req.query, errors));
    if (errors.length) return badRequest(res, errors);
    const match = { createdAt: range };

    const completedGroup = { completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } } };
    const [quick, out, users, drivers, vehicleTypes] = await Promise.all([
      daily(QuickRide, match, completedGroup),
      daily(OutstationRide, match, completedGroup),
      daily(User, match),
      daily(Driver, match),
      Vehicle.aggregate([
        { $group: { _id: '$vehicleTypeId', count: { $sum: 1 } } },
        { $lookup: { from: 'vehicletypes', localField: '_id', foreignField: '_id', as: 'type' } },
        { $project: { count: 1, name: { $ifNull: [{ $arrayElemAt: ['$type.name', 0] }, 'Unknown'] } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const index = (rows) => Object.fromEntries(rows.map((r) => [r._id, r]));
    const q = index(quick);
    const o = index(out);
    const u = index(users);
    const d = index(drivers);

    const days = daysBetween(range).map((day) => ({
      day,
      quickRides: q[day]?.count || 0,
      outstationRides: o[day]?.count || 0,
      completed: (q[day]?.completed || 0) + (o[day]?.completed || 0),
      newCustomers: u[day]?.count || 0,
      newDrivers: d[day]?.count || 0,
    }));

    return res.status(200).json({
      range: { from: range.$gte, to: range.$lte, timezone: TZ },
      days,
      vehicleTypes: vehicleTypes.map((v) => ({ name: v.name, count: v.count })),
    });
  });

  // GET /admin/badges — the small counts on the sidebar
  badges = handle('load counts', async (req, res) => {
    const [pendingKyc, activeQuick, activeOut] = await Promise.all([
      Driver.countDocuments({ kycMethod: 'manual', kycStatus: 'pending' }),
      QuickRide.countDocuments({ rideStatus: { $in: ACTIVE_RIDE_STATUSES } }),
      OutstationRide.countDocuments({ rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES } }),
    ]);
    return res.status(200).json({ pendingKyc, activeQuickRides: activeQuick, activeOutstationRides: activeOut });
  });
}
