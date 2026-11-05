import { User } from '../../models/user.model.js';
import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { QuickDestination } from '../../models/quickDestination.model.js';
import { Review } from '../../models/review.model.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../../constants/ride.constants.js';
import { recordAudit, diffFields } from '../../services/admin/audit.service.js';
import { enforceBlock } from '../../services/admin/accountBlock.service.js';
import {
  USER_HIDDEN, badRequest, containsRegex, dateFilter, handle, isId, listResponse, maskPerson, pageParams, readReason, sortParams, toId,
} from './helpers.js';
import { countBy } from './metrics.js';

const rideCountsFor = async (Model, field, ids) => {
  const rows = await Model.aggregate([
    { $match: { [field]: { $in: ids } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, last: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

export class CustomersController {
  // GET /admin/customers?q&from&to&blocked=true|false&hasRides=true|false&sort=newest|oldest|name
  list = handle('load customers', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const errors = [];
    const createdAt = dateFilter(req.query, errors);
    if (errors.length) return badRequest(res, errors);

    const filter = {};
    if (createdAt) filter.createdAt = createdAt;
    if (req.query.blocked === 'true') filter.isBlocked = true;
    if (req.query.blocked === 'false') filter.isBlocked = { $ne: true };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [{ name: containsRegex(q) }, { phoneNumber: containsRegex(q) }];
      if (isId(q)) filter.$or.push({ _id: toId(q) });
    }
    if (req.query.hasRides === 'true' || req.query.hasRides === 'false') {
      const [a, b] = await Promise.all([QuickRide.distinct('bookedBy'), OutstationRide.distinct('bookedBy')]);
      const riders = [...a, ...b];
      filter._id = req.query.hasRides === 'true' ? { $in: riders } : { $nin: riders };
    }

    const legacy = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const sort = sortParams(req.query, { name: 'name', joined: 'createdAt', status: 'isBlocked' }, legacy);
    const [rows, total] = await Promise.all([
      User.find(filter).select(USER_HIDDEN).sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const ids = rows.map((r) => r._id);
    const [quick, out] = await Promise.all([rideCountsFor(QuickRide, 'bookedBy', ids), rideCountsFor(OutstationRide, 'bookedBy', ids)]);
    const data = rows.map((u) => {
      const q = quick.get(String(u._id));
      const o = out.get(String(u._id));
      const last = [q?.last, o?.last].filter(Boolean).sort((x, y) => y - x)[0] || null;
      return maskPerson(req, { ...u, quickRides: q?.count || 0, outstationRides: o?.count || 0, lastRideAt: last });
    });
    return listResponse(res, { data, total, page, limit });
  });

  // GET /admin/customers/:id
  detail = handle('load customer', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid customer id' });
    const user = await User.findById(id).select(USER_HIDDEN).lean();
    if (!user) return res.status(404).json({ message: 'Customer not found' });

    const match = { bookedBy: user._id };
    const statusAgg = (Model) =>
      Model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$rideStatus',
            count: { $sum: 1 },
            value: { $sum: { $cond: [{ $eq: ['$rideStatus', 'completed'] }, { $ifNull: ['$finalFare', 0] }, 0] } },
          },
        },
      ]);
    const [quick, out, destinations, reviews, activeQuick, activeOut] = await Promise.all([
      statusAgg(QuickRide),
      statusAgg(OutstationRide),
      QuickDestination.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Review.find({ userId: user._id }).populate('driverId', 'name').sort({ createdAt: -1 }).limit(50).lean(),
      QuickRide.countDocuments({ ...match, rideStatus: { $in: ACTIVE_RIDE_STATUSES } }),
      OutstationRide.countDocuments({ ...match, rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES } }),
    ]);
    const value = (rows) => rows.reduce((s, r) => s + r.value, 0);

    return res.status(200).json({
      customer: maskPerson(req, user),
      rides: {
        quick: { byStatus: countBy(quick), total: quick.reduce((s, r) => s + r.count, 0), completedValue: value(quick) },
        outstation: { byStatus: countBy(out), total: out.reduce((s, r) => s + r.count, 0), completedValue: value(out) },
        active: activeQuick + activeOut,
      },
      destinations: destinations.map((d) => ({
        _id: d._id,
        tag: d.tag,
        dropLocationName: d.dropLocationName,
        longitude: d.dropCoordinates?.coordinates?.[0],
        latitude: d.dropCoordinates?.coordinates?.[1],
        createdAt: d.createdAt,
      })),
      reviews,
    });
  });

  // PATCH /admin/customers/:id  { name?, title?, sosContact? }
  update = handle('update customer', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid customer id' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Customer not found' });

    const errors = [];
    const body = req.body || {};
    const before = user.toObject();
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      else user.name = name;
    }
    if (body.title !== undefined) user.title = String(body.title).trim();
    if (body.sosContact !== undefined) {
      const sos = String(body.sosContact ?? '').trim();
      if (sos && !/^[6-9]\d{9}$/.test(sos)) errors.push({ field: 'sosContact', message: 'Enter a 10-digit mobile number starting with 6-9' });
      else user.sosContact = sos || undefined;
    }
    if (errors.length) return badRequest(res, errors);

    await user.save();
    const diff = diffFields(before, user.toObject(), ['name', 'title', 'sosContact']);
    await recordAudit(req, { action: 'customer.update', entity: 'user', entityId: user._id, ...diff });
    return res.status(200).json(maskPerson(req, user.toObject()));
  });

  // PATCH /admin/customers/:id/block  { blocked: true|false, reason }
  block = handle('change customer access', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid customer id' });
    const errors = [];
    const reason = readReason(req.body, errors);
    if (typeof req.body?.blocked !== 'boolean') errors.push({ field: 'blocked', message: 'blocked must be true or false' });
    if (errors.length) return badRequest(res, errors);

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    const blocked = req.body.blocked;
    if (Boolean(user.isBlocked) === blocked) {
      return res.status(409).json({ message: blocked ? 'Customer is already blocked' : 'Customer is not blocked' });
    }

    const before = { isBlocked: Boolean(user.isBlocked), blockedReason: user.blockedReason || '' };
    user.isBlocked = blocked;
    user.blockedReason = blocked ? reason : '';
    user.blockedAt = blocked ? new Date() : null;
    user.blockedBy = blocked ? req.admin._id : null;
    await user.save();
    if (blocked) await enforceBlock('user', user._id);

    await recordAudit(req, {
      action: blocked ? 'customer.block' : 'customer.unblock',
      entity: 'user',
      entityId: user._id,
      before,
      after: { isBlocked: user.isBlocked, blockedReason: user.blockedReason },
      reason,
    });
    return res.status(200).json({ message: blocked ? 'Customer blocked' : 'Customer unblocked', isBlocked: user.isBlocked });
  });
}
