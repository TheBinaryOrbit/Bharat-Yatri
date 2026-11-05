import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { Driver } from '../../models/driver.model.js';
import { User } from '../../models/user.model.js';
import { Review } from '../../models/review.model.js';
import { InstallReferrer } from '../../models/installReferrer.model.js';
import { INSTALL_APPS } from '../../constants/install.constants.js';
import { badRequest, canSeePii, dateFilter, handle, maskPhone } from './helpers.js';
import { areaExpr, dayKey, daysBetween, defaultRange, TZ } from './metrics.js';

const MODELS = { quickride: QuickRide, outstation: OutstationRide };
const pickModels = (rideType) => (MODELS[rideType] ? [[rideType, MODELS[rideType]]] : Object.entries(MODELS));

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ?format=csv on any report sends its main table as a download. Gated on reports.export here,
// not just by hiding the button.
const maybeCsv = (req, res, name, columns, rows) => {
  if (req.query.format !== 'csv') return false;
  if (!req.permissions.has('reports.export')) {
    res.status(403).json({ message: 'You do not have permission to export reports' });
    return true;
  }
  const lines = [columns.map((c) => csvCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200).send(`﻿${lines.join('\n')}`);
  return true;
};

const readRange = (req, res) => {
  const errors = [];
  const range = defaultRange(dateFilter(req.query, errors));
  if (errors.length) {
    badRequest(res, errors);
    return null;
  }
  return range;
};

export class ReportsController {
  // GET /admin/reports/rides?from&to&rideType
  rides = handle('build ride report', async (req, res) => {
    const range = readRange(req, res);
    if (!range) return undefined;
    const match = { createdAt: range };

    const perType = await Promise.all(
      pickModels(req.query.rideType).map(async ([type, Model]) => {
        const [daily, totals, byVehicle, acceptance] = await Promise.all([
          Model.aggregate([
            { $match: match },
            {
              $group: {
                _id: dayKey(),
                created: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$rideStatus', 'cancelled'] }, 1, 0] } },
                expired: { $sum: { $cond: [{ $eq: ['$rideStatus', 'expired'] }, 1, 0] } },
                value: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, { $ifNull: ['$finalFare', 0] }, 0] } },
              },
            },
          ]),
          Model.aggregate([
            { $match: match },
            {
              $group: {
                _id: '$rideStatus',
                count: { $sum: 1 },
                value: { $sum: { $ifNull: ['$finalFare', 0] } },
                avgDistance: { $avg: '$estimatedDistanceKm' },
                avgOffered: { $avg: '$offeredFare' },
              },
            },
          ]),
          Model.aggregate([
            { $match: match },
            {
              $group: {
                _id: '$vehicleTypeId',
                rides: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } },
                value: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, { $ifNull: ['$finalFare', 0] }, 0] } },
              },
            },
            { $lookup: { from: 'vehicletypes', localField: '_id', foreignField: '_id', as: 't' } },
            { $project: { rides: 1, completed: 1, value: 1, name: { $ifNull: [{ $arrayElemAt: ['$t.name', 0] }, 'Unknown'] } } },
            { $sort: { rides: -1 } },
          ]),
          // Booking → accepted bid, from the accepted bid's own timestamp. Only accepted bids
          // survive long enough on QuickRide to measure, which is exactly what this needs.
          Model.aggregate([
            { $match: { ...match, acceptedBidId: { $ne: null } } },
            { $lookup: { from: type === 'quickride' ? 'quickridebids' : 'outstationridebids', localField: 'acceptedBidId', foreignField: '_id', as: 'bid' } },
            { $unwind: '$bid' },
            { $project: { mins: { $divide: [{ $subtract: ['$bid.updatedAt', '$createdAt'] }, 60000] }, fareDelta: { $subtract: ['$bid.fare', '$offeredFare'] } } },
            { $group: { _id: null, accepted: { $sum: 1 }, avgMinutesToAccept: { $avg: '$mins' }, avgFareDelta: { $avg: '$fareDelta' } } },
          ]),
        ]);

        const status = Object.fromEntries(totals.map((t) => [t._id, t]));
        const created = totals.reduce((s, t) => s + t.count, 0);
        const completed = status.completed?.count || 0;
        const cancelled = status.cancelled?.count || 0;
        const expired = status.expired?.count || 0;
        return {
          rideType: type,
          daily: Object.fromEntries(daily.map((d) => [d._id, d])),
          summary: {
            created,
            completed,
            cancelled,
            expired,
            byStatus: Object.fromEntries(totals.map((t) => [t._id, t.count])),
            completionRate: created ? completed / created : null,
            cancellationRate: created ? cancelled / created : null,
            noDriverRate: created ? expired / created : null,
            completedValue: status.completed?.value || 0,
            avgDistanceKm: created ? totals.reduce((s, t) => s + (t.avgDistance || 0) * t.count, 0) / created : null,
            avgOfferedFare: created ? totals.reduce((s, t) => s + (t.avgOffered || 0) * t.count, 0) / created : null,
            accepted: acceptance[0]?.accepted || 0,
            avgMinutesToAccept: acceptance[0]?.avgMinutesToAccept ?? null,
            avgAcceptedFareVsOffer: acceptance[0]?.avgFareDelta ?? null,
          },
          byVehicleType: byVehicle.map(({ _id, ...v }) => v),
        };
      })
    );

    const days = daysBetween(range).map((day) => {
      const row = { day };
      perType.forEach((t) => {
        const d = t.daily[day] || {};
        row[`${t.rideType}Created`] = d.created || 0;
        row[`${t.rideType}Completed`] = d.completed || 0;
        row[`${t.rideType}Cancelled`] = d.cancelled || 0;
        row[`${t.rideType}Expired`] = d.expired || 0;
        row[`${t.rideType}Value`] = d.value || 0;
      });
      return row;
    });

    const columns = [{ label: 'Day', get: (r) => r.day }];
    perType.forEach((t) => {
      ['Created', 'Completed', 'Cancelled', 'Expired', 'Value'].forEach((k) => columns.push({ label: `${t.rideType} ${k.toLowerCase()}`, get: (r) => r[`${t.rideType}${k}`] }));
    });
    if (maybeCsv(req, res, 'ride-report', columns, days)) return undefined;

    return res.status(200).json({
      range: { from: range.$gte, to: range.$lte, timezone: TZ },
      days,
      types: perType.map(({ daily, ...t }) => t),
    });
  });

  // GET /admin/reports/drivers?from&to&rideType — top drivers by completed rides in the window
  drivers = handle('build driver report', async (req, res) => {
    const range = readRange(req, res);
    if (!range) return undefined;
    const match = { createdAt: range, assignedTo: { $ne: null } };
    const group = {
      $group: {
        _id: '$assignedTo',
        assigned: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } },
        cancelledByDriver: { $sum: { $cond: [{ $eq: ['$cancelledBy', 'driver'] }, 1, 0] } },
        value: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, { $ifNull: ['$finalFare', 0] }, 0] } },
      },
    };
    const parts = await Promise.all(pickModels(req.query.rideType).map(([, M]) => M.aggregate([{ $match: match }, group])));
    const merged = new Map();
    parts.flat().forEach((r) => {
      const k = String(r._id);
      const m = merged.get(k) || { _id: r._id, assigned: 0, completed: 0, cancelledByDriver: 0, value: 0 };
      m.assigned += r.assigned;
      m.completed += r.completed;
      m.cancelledByDriver += r.cancelledByDriver;
      m.value += r.value;
      merged.set(k, m);
    });
    const top = [...merged.values()].sort((a, b) => b.completed - a.completed || b.value - a.value).slice(0, 100);

    const ids = top.map((t) => t._id);
    const [drivers, ratings] = await Promise.all([
      Driver.find({ _id: { $in: ids } }).select('name phoneNumber').lean(),
      Review.aggregate([{ $match: { driverId: { $in: ids } } }, { $group: { _id: '$driverId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    ]);
    const dBy = new Map(drivers.map((d) => [String(d._id), d]));
    const rBy = new Map(ratings.map((r) => [String(r._id), r]));
    const pii = canSeePii(req);
    const rows = top.map((t) => {
      const d = dBy.get(String(t._id));
      const r = rBy.get(String(t._id));
      return {
        driverId: t._id,
        name: d?.name || '—',
        phoneNumber: pii ? d?.phoneNumber : maskPhone(d?.phoneNumber),
        assigned: t.assigned,
        completed: t.completed,
        cancelledByDriver: t.cancelledByDriver,
        completedValue: t.value,
        rating: r ? Math.round(r.avg * 10) / 10 : null,
        reviews: r?.count || 0,
      };
    });

    if (
      maybeCsv(req, res, 'driver-report', [
        { label: 'Driver', get: (r) => r.name },
        { label: 'Phone', get: (r) => r.phoneNumber },
        { label: 'Assigned', get: (r) => r.assigned },
        { label: 'Completed', get: (r) => r.completed },
        { label: 'Cancelled by driver', get: (r) => r.cancelledByDriver },
        { label: 'Completed ride value', get: (r) => r.completedValue },
        { label: 'Rating', get: (r) => r.rating },
        { label: 'Reviews', get: (r) => r.reviews },
      ], rows)
    ) return undefined;

    return res.status(200).json({ range: { from: range.$gte, to: range.$lte }, data: rows });
  });

  // GET /admin/reports/customers?from&to&rideType — most active riders in the window
  customers = handle('build customer report', async (req, res) => {
    const range = readRange(req, res);
    if (!range) return undefined;
    const group = {
      $group: {
        _id: '$bookedBy',
        booked: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } },
        cancelledByUser: { $sum: { $cond: [{ $eq: ['$cancelledBy', 'user'] }, 1, 0] } },
        value: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, { $ifNull: ['$finalFare', 0] }, 0] } },
      },
    };
    const parts = await Promise.all(pickModels(req.query.rideType).map(([, M]) => M.aggregate([{ $match: { createdAt: range } }, group])));
    const merged = new Map();
    parts.flat().forEach((r) => {
      const k = String(r._id);
      const m = merged.get(k) || { _id: r._id, booked: 0, completed: 0, cancelledByUser: 0, value: 0 };
      m.booked += r.booked;
      m.completed += r.completed;
      m.cancelledByUser += r.cancelledByUser;
      m.value += r.value;
      merged.set(k, m);
    });
    const top = [...merged.values()].sort((a, b) => b.booked - a.booked).slice(0, 100);
    const users = await User.find({ _id: { $in: top.map((t) => t._id) } }).select('name phoneNumber createdAt').lean();
    const uBy = new Map(users.map((u) => [String(u._id), u]));
    const pii = canSeePii(req);
    const rows = top.map((t) => {
      const u = uBy.get(String(t._id));
      return {
        customerId: t._id,
        name: u?.name || '—',
        phoneNumber: pii ? u?.phoneNumber : maskPhone(u?.phoneNumber),
        joinedAt: u?.createdAt || null,
        booked: t.booked,
        completed: t.completed,
        cancelledByUser: t.cancelledByUser,
        completedValue: t.value,
      };
    });
    if (
      maybeCsv(req, res, 'customer-report', [
        { label: 'Customer', get: (r) => r.name },
        { label: 'Phone', get: (r) => r.phoneNumber },
        { label: 'Booked', get: (r) => r.booked },
        { label: 'Completed', get: (r) => r.completed },
        { label: 'Cancelled by customer', get: (r) => r.cancelledByUser },
        { label: 'Completed ride value', get: (r) => r.completedValue },
      ], rows)
    ) return undefined;
    return res.status(200).json({ range: { from: range.$gte, to: range.$lte }, data: rows });
  });

  // GET /admin/reports/areas?from&to&rideType — busiest pickup and drop areas (from the address text)
  areas = handle('build area report', async (req, res) => {
    const range = readRange(req, res);
    if (!range) return undefined;
    const byArea = (Model, field) =>
      Model.aggregate([
        { $match: { createdAt: range } },
        {
          $group: {
            _id: areaExpr(`$${field}`),
            rides: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $eq: ['$rideStatus', 'expired'] }, 1, 0] } },
          },
        },
      ]);
    const models = pickModels(req.query.rideType);
    const [pickups, drops] = await Promise.all([
      Promise.all(models.map(([, M]) => byArea(M, 'pickupLocationName'))),
      Promise.all(models.map(([, M]) => byArea(M, 'dropLocationName'))),
    ]);
    const merge = (lists) => {
      const m = new Map();
      lists.flat().forEach((r) => {
        const k = r._id || 'Unknown';
        const cur = m.get(k) || { area: k, rides: 0, completed: 0, expired: 0 };
        cur.rides += r.rides;
        cur.completed += r.completed;
        cur.expired += r.expired;
        m.set(k, cur);
      });
      return [...m.values()].sort((a, b) => b.rides - a.rides).slice(0, 50);
    };
    const pickupRows = merge(pickups);
    if (
      maybeCsv(req, res, 'area-report', [
        { label: 'Pickup area', get: (r) => r.area },
        { label: 'Rides', get: (r) => r.rides },
        { label: 'Completed', get: (r) => r.completed },
        { label: 'No driver (expired)', get: (r) => r.expired },
      ], pickupRows)
    ) return undefined;
    return res.status(200).json({
      range: { from: range.$gte, to: range.$lte },
      note: 'Area is read from the address text (the locality before the state), so it is approximate.',
      pickups: pickupRows,
      drops: merge(drops),
    });
  });

  // GET /admin/install-referrers/timeseries?app&from&to — installs and sign-ups per day
  referrerTimeseries = handle('build install chart', async (req, res) => {
    const range = readRange(req, res);
    if (!range) return undefined;
    const match = { installTime: range };
    if (INSTALL_APPS.includes(req.query.app)) match.app = req.query.app;
    const rows = await InstallReferrer.aggregate([
      { $match: match },
      {
        $group: {
          _id: dayKey('$installTime'),
          installs: { $sum: 1 },
          signups: { $sum: { $cond: [{ $or: [{ $ne: ['$userId', null] }, { $ne: ['$driverId', null] }] }, 1, 0] } },
        },
      },
    ]);
    const by = new Map(rows.map((r) => [r._id, r]));
    const days = daysBetween(range).map((day) => ({ day, installs: by.get(day)?.installs || 0, signups: by.get(day)?.signups || 0 }));
    return res.status(200).json({ range: { from: range.$gte, to: range.$lte }, days });
  });
}
