import { Driver } from '../../models/driver.model.js';
import { Vehicle } from '../../models/vehicle.model.js';
import { Review } from '../../models/review.model.js';
import { PaymentDetails } from '../../models/paymentDetails.model.js';
import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { QuickRideBid } from '../../models/quickRideBid.model.js';
import { OutstationRideBid } from '../../models/outstationRideBid.model.js';
import { KYC_STATUSES, KYC_METHODS } from '../../constants/driver.constants.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../../constants/ride.constants.js';
import { DriverService } from '../../services/driver.service.js';
import { LiveService } from '../../services/admin/live.service.js';
import { recordAudit } from '../../services/admin/audit.service.js';
import { enforceBlock } from '../../services/admin/accountBlock.service.js';
import { notifyDriver } from '../../notifications/index.js';
import { kycProgress } from '../../utils/kycProgress.js';
import { onboardingProgress } from '../../utils/onboardingProgress.js';
import {
  DRIVER_HIDDEN, badRequest, canSeePii, containsRegex, dateFilter, handle, isId, listResponse, maskPerson, maskUpi,
  pageParams, readReason, toId,
} from './helpers.js';
import { countBy } from './metrics.js';

const driverService = new DriverService();
const liveService = new LiveService();

const ratingsFor = async (ids) => {
  const rows = await Review.aggregate([
    { $match: { driverId: { $in: ids } } },
    { $group: { _id: '$driverId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { average: Math.round(r.average * 10) / 10, count: r.count }]));
};

const completedFor = async (Model, ids) => {
  const rows = await Model.aggregate([
    { $match: { assignedTo: { $in: ids }, rideStatus: 'completed' } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

// The KYC images and what was typed at onboarding, side by side, for the reviewer.
const kycCase = (req, d) => ({
  _id: d._id,
  name: d.name,
  phoneNumber: d.phoneNumber,
  profileImageUrl: d.profileImageUrl,
  dob: d.dob,
  gender: d.gender,
  address: d.address,
  aadharCardNumber: d.aadharCardNumber,
  kycStatus: d.kycStatus,
  kycMethod: d.kycMethod,
  kycFailedReason: d.kycFailedReason,
  aadhaarName: d.kycDetails?.aadhaarName || '',
  manualKyc: d.manualKyc || null,
  dlDetails: d.dlDetails || {},
  isBlocked: d.isBlocked,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export class DriversController {
  // GET /admin/drivers?q&kycStatus&kycMethod&blocked&vehicleTypeId&onboarding=complete|incomplete&from&to&sort
  list = handle('load drivers', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const errors = [];
    const createdAt = dateFilter(req.query, errors);
    const { kycStatus, kycMethod } = req.query;
    if (kycStatus && !KYC_STATUSES.includes(kycStatus)) errors.push({ field: 'kycStatus', message: 'Unknown KYC status' });
    if (kycMethod && !KYC_METHODS.includes(kycMethod)) errors.push({ field: 'kycMethod', message: 'Unknown KYC method' });
    if (errors.length) return badRequest(res, errors);

    const filter = {};
    if (createdAt) filter.createdAt = createdAt;
    if (kycStatus) filter.kycStatus = kycStatus;
    if (kycMethod) filter.kycMethod = kycMethod;
    if (req.query.blocked === 'true') filter.isBlocked = true;
    if (req.query.blocked === 'false') filter.isBlocked = { $ne: true };
    if (req.query.onboarding === 'complete') filter.isProfileComplete = true;
    if (req.query.onboarding === 'incomplete') filter.isProfileComplete = { $ne: true };

    const idSets = [];
    if (req.query.q) {
      const q = String(req.query.q).trim();
      const byVehicle = await Vehicle.find({ vehicleNumber: containsRegex(q.toUpperCase()) }).distinct('driverId');
      filter.$or = [{ name: containsRegex(q) }, { phoneNumber: containsRegex(q) }, { email: containsRegex(q) }, { _id: { $in: byVehicle } }];
      if (isId(q)) filter.$or.push({ _id: toId(q) });
    }
    if (isId(req.query.vehicleTypeId)) {
      idSets.push(await Vehicle.find({ vehicleTypeId: req.query.vehicleTypeId }).distinct('driverId'));
    }
    if (idSets.length) filter._id = { $in: idSets[0] };

    const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const [rows, total] = await Promise.all([
      Driver.find(filter)
        .select('name phoneNumber email profileImageUrl kycStatus kycMethod isKycCompleted isProfileComplete onboardingStep isBlocked createdAt')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Driver.countDocuments(filter),
    ]);

    const ids = rows.map((r) => r._id);
    const [vehicles, ratings, quickDone, outDone] = await Promise.all([
      Vehicle.find({ driverId: { $in: ids } }).populate('vehicleTypeId', 'name').select('driverId vehicleNumber vehicleName vehicleTypeId').lean(),
      ratingsFor(ids),
      completedFor(QuickRide, ids),
      completedFor(OutstationRide, ids),
    ]);
    const vehicleBy = new Map(vehicles.map((v) => [String(v.driverId), v]));

    const data = rows.map((d) => {
      const v = vehicleBy.get(String(d._id));
      return maskPerson(req, {
        ...d,
        onboarding: onboardingProgress(d),
        vehicle: v ? { _id: v._id, vehicleNumber: v.vehicleNumber, vehicleName: v.vehicleName, vehicleType: v.vehicleTypeId?.name || null } : null,
        rating: ratings.get(String(d._id)) || { average: null, count: 0 },
        completedRides: (quickDone.get(String(d._id)) || 0) + (outDone.get(String(d._id)) || 0),
      });
    });
    return listResponse(res, { data, total, page, limit });
  });

  // GET /admin/drivers/:id
  detail = handle('load driver', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const driver = await Driver.findById(id).select(DRIVER_HIDDEN).lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const match = { assignedTo: driver._id };
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

    const [vehicle, payment, ratingRows, quick, out, quickBids, outBids, activeQuick, activeOut, live] = await Promise.all([
      Vehicle.findOne({ driverId: driver._id }).populate('vehicleTypeId', 'name slug capacity').lean(),
      PaymentDetails.findOne({ driverId: driver._id }).lean(),
      Review.aggregate([{ $match: { driverId: driver._id } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
      statusAgg(QuickRide),
      statusAgg(OutstationRide),
      QuickRideBid.countDocuments({ requestedBy: driver._id }),
      OutstationRideBid.countDocuments({ requestedBy: driver._id }),
      QuickRide.findOne({ ...match, rideStatus: { $in: ACTIVE_RIDE_STATUSES } }).select('_id rideStatus').lean(),
      OutstationRide.findOne({ ...match, rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES } }).select('_id rideStatus pickupAt').lean(),
      liveService.driverLiveState(driver._id).catch(() => ({ state: 'unknown' })),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingRows.forEach((r) => { distribution[r._id] = r.count; });
    const reviewCount = Object.values(distribution).reduce((s, n) => s + n, 0);
    const average = reviewCount
      ? Math.round((Object.entries(distribution).reduce((s, [k, n]) => s + Number(k) * n, 0) / reviewCount) * 10) / 10
      : null;
    const value = (rows) => rows.reduce((s, r) => s + r.value, 0);

    const pii = canSeePii(req);
    return res.status(200).json({
      driver: maskPerson(req, { ...driver }),
      onboarding: onboardingProgress(driver),
      kyc: { ...kycProgress(driver), aadhaarName: driver.kycDetails?.aadhaarName || '' },
      vehicle,
      payment: payment ? { upiId: pii ? payment.upiId : maskUpi(payment.upiId), updatedAt: payment.updatedAt, createdAt: payment.createdAt } : null,
      rating: { average, count: reviewCount, distribution },
      rides: {
        quick: { byStatus: countBy(quick), total: quick.reduce((s, r) => s + r.count, 0), completedValue: value(quick) },
        outstation: { byStatus: countBy(out), total: out.reduce((s, r) => s + r.count, 0), completedValue: value(out) },
      },
      bids: { quick: quickBids, outstation: outBids },
      activeRide: activeQuick ? { ...activeQuick, rideType: 'quickride' } : activeOut ? { ...activeOut, rideType: 'outstation' } : null,
      live,
    });
  });

  // GET /admin/drivers/:id/reviews?rating
  reviews = handle('load driver reviews', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const { page, limit, skip } = pageParams(req.query);
    const filter = { driverId: toId(id) };
    const rating = Number(req.query.rating);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter.rating = rating;
    if (req.query.hasComment === 'true') filter.comment = { $nin: ['', null] };

    const [rows, total] = await Promise.all([
      Review.find(filter).populate('userId', 'name phoneNumber').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);
    rows.forEach((r) => maskPerson(req, r.userId));
    return listResponse(res, { data: rows, total, page, limit });
  });

  // DELETE /admin/drivers/:id/reviews/:reviewId  { reason }
  deleteReview = handle('remove review', async (req, res) => {
    const { id, reviewId } = req.params;
    if (!isId(id) || !isId(reviewId)) return res.status(400).json({ message: 'Invalid id' });
    const errors = [];
    const reason = readReason(req.body, errors);
    if (errors.length) return badRequest(res, errors);

    const review = await Review.findOneAndDelete({ _id: reviewId, driverId: id });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    await recordAudit(req, { action: 'review.remove', entity: 'review', entityId: review._id, before: review, reason });
    return res.status(200).json({ message: 'Review removed' });
  });

  // GET /admin/drivers/:id/bids?rideType=quickride|outstation
  bids = handle('load driver bids', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const { page, limit, skip } = pageParams(req.query);
    const outstation = req.query.rideType === 'outstation';
    const Model = outstation ? OutstationRideBid : QuickRideBid;
    const rideField = outstation ? 'outstationRideId' : 'quickRideId';
    const filter = { requestedBy: toId(id) };
    const [rows, total] = await Promise.all([
      Model.find(filter)
        .populate(rideField, 'pickupLocationName dropLocationName rideStatus offeredFare createdAt acceptedBidId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(filter),
    ]);
    const data = rows.map((b) => ({ ...b, ride: b[rideField] || null, rideType: outstation ? 'outstation' : 'quickride' }));
    return listResponse(res, { data, total, page, limit });
  });

  // PATCH /admin/drivers/:id/block  { blocked, reason }
  block = handle('change driver access', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const errors = [];
    const reason = readReason(req.body, errors);
    if (typeof req.body?.blocked !== 'boolean') errors.push({ field: 'blocked', message: 'blocked must be true or false' });
    if (errors.length) return badRequest(res, errors);

    const driver = await Driver.findById(id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const blocked = req.body.blocked;
    if (Boolean(driver.isBlocked) === blocked) {
      return res.status(409).json({ message: blocked ? 'Driver is already blocked' : 'Driver is not blocked' });
    }

    const before = { isBlocked: Boolean(driver.isBlocked), blockedReason: driver.blockedReason || '' };
    driver.isBlocked = blocked;
    driver.blockedReason = blocked ? reason : '';
    driver.blockedAt = blocked ? new Date() : null;
    driver.blockedBy = blocked ? req.admin._id : null;
    await driver.save();
    if (blocked) await enforceBlock('driver', driver._id);

    await recordAudit(req, {
      action: blocked ? 'driver.block' : 'driver.unblock',
      entity: 'driver',
      entityId: driver._id,
      before,
      after: { isBlocked: driver.isBlocked, blockedReason: driver.blockedReason },
      reason,
    });
    return res.status(200).json({ message: blocked ? 'Driver blocked' : 'Driver unblocked', isBlocked: driver.isBlocked });
  });

  // GET /admin/kyc?status=pending&method=manual&q — the review queue, oldest submission first
  kycQueue = handle('load KYC queue', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const status = req.query.status || 'pending';
    const method = req.query.method || 'manual';
    const errors = [];
    if (!KYC_STATUSES.includes(status)) errors.push({ field: 'status', message: 'Unknown KYC status' });
    if (method !== 'any' && !KYC_METHODS.includes(method)) errors.push({ field: 'method', message: 'Unknown KYC method' });
    if (errors.length) return badRequest(res, errors);

    const filter = { kycStatus: status };
    if (method !== 'any') filter.kycMethod = method;
    if (req.query.q) filter.$or = [{ name: containsRegex(req.query.q) }, { phoneNumber: containsRegex(req.query.q) }];

    const sort = status === 'pending' ? { 'manualKyc.submittedAt': 1, updatedAt: 1 } : { updatedAt: -1 };
    const [rows, total, counts] = await Promise.all([
      Driver.find(filter).select(DRIVER_HIDDEN).sort(sort).skip(skip).limit(limit).lean(),
      Driver.countDocuments(filter),
      Driver.aggregate([{ $match: { kycMethod: 'manual' } }, { $group: { _id: '$kycStatus', count: { $sum: 1 } } }]).then(countBy),
    ]);
    return listResponse(res, { data: rows.map((d) => maskPerson(req, kycCase(req, d))), total, page, limit, counts });
  });

  // GET /admin/kyc/:id — one case for the review screen
  kycCaseDetail = handle('load KYC case', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const driver = await Driver.findById(id).select(DRIVER_HIDDEN).lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const vehicle = await Vehicle.findOne({ driverId: driver._id }).populate('vehicleTypeId', 'name').lean();
    return res.status(200).json({ case: maskPerson(req, kycCase(req, driver)), kyc: kycProgress(driver), onboarding: onboardingProgress(driver), vehicle });
  });

  // PATCH /admin/kyc/:id/review  { decision: 'approve'|'reject', reason }
  // Same one-shot rule as the existing /drivers/:id/kyc/review: only a pending manual request moves.
  kycReview = handle('review KYC', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const { decision } = req.body || {};
    const errors = [];
    if (!['approve', 'reject'].includes(decision)) errors.push({ field: 'decision', message: "Decision must be 'approve' or 'reject'" });
    const reason = readReason(req.body, errors, { required: decision === 'reject' });
    if (errors.length) return badRequest(res, errors);

    const approved = decision === 'approve';
    const driver = await driverService.reviewPendingManualKyc(id, {
      kycStatus: approved ? 'verified' : 'rejected',
      isKycCompleted: approved,
      kycFailedReason: approved ? '' : reason,
      'manualKyc.reviewedAt': new Date(),
    });

    if (!driver) {
      const exists = await Driver.findById(id).lean();
      if (!exists) return res.status(404).json({ message: 'Driver not found' });
      return res.status(409).json({ message: 'This driver has no manual KYC request waiting for review', kyc: kycProgress(exists) });
    }

    if (approved) notifyDriver(driver._id, 'kyc:verified', {});
    else notifyDriver(driver._id, 'kyc:rejected', { reason });

    await recordAudit(req, {
      action: approved ? 'kyc.approve' : 'kyc.reject',
      entity: 'driver',
      entityId: driver._id,
      before: { kycStatus: 'pending' },
      after: { kycStatus: driver.kycStatus },
      reason,
    });
    return res.status(200).json({ message: approved ? 'KYC approved' : 'KYC rejected', kyc: kycProgress(driver) });
  });
}
