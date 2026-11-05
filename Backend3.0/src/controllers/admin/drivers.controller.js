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
import { recordAudit, diffFields } from '../../services/admin/audit.service.js';
import { enforceBlock } from '../../services/admin/accountBlock.service.js';
import { notifyDriver } from '../../notifications/index.js';
import { kycProgress } from '../../utils/kycProgress.js';
import { onboardingProgress } from '../../utils/onboardingProgress.js';
import {
  DRIVER_HIDDEN, badRequest, canSeePii, containsRegex, dateFilter, handle, isId, listResponse, maskPerson, maskUpi,
  pageParams, readReason, sortParams, toId,
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

// Which KYC documents a driver has NOT provided. Identity counts as present when either the
// DigiLocker record came back or both manual Aadhaar photos were uploaded.
export const missingKycDocuments = (d) => {
  const missing = [];
  const digilocker = Boolean(d.kycDetails?.adharFileId || d.kycDetails?.requestId);
  if (!digilocker) {
    if (!d.manualKyc?.aadhaarFrontImageUrl) missing.push({ key: 'aadhaarFront', label: 'Aadhaar front photo' });
    if (!d.manualKyc?.aadhaarBackImageUrl) missing.push({ key: 'aadhaarBack', label: 'Aadhaar back photo' });
  }
  if (!d.dlDetails?.dlNumber) missing.push({ key: 'dlNumber', label: 'Driving licence number' });
  if (!d.dlDetails?.dlFrontImageUrl) missing.push({ key: 'dlFront', label: 'Driving licence front photo' });
  if (!d.dlDetails?.dlBackImageUrl) missing.push({ key: 'dlBack', label: 'Driving licence back photo' });
  return missing;
};

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

    const legacy = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const sort = sortParams(
      req.query,
      { name: 'name', kyc: 'kycStatus', onboarding: ['isProfileComplete', 'onboardingStep'], joined: 'createdAt', status: 'isBlocked' },
      legacy
    );
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
      kyc: { ...kycProgress(driver), aadhaarName: driver.kycDetails?.aadhaarName || '', missingDocuments: missingKycDocuments(driver) },
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

  // PATCH /admin/drivers/:id  { name?, email?, dob?, gender?, address?, dlNumber? }
  // The phone number is the login and is not editable here; KYC fields have their own flow.
  update = handle('update driver', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const driver = await Driver.findById(id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const body = req.body || {};
    const errors = [];
    const set = {};
    const unset = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      else if (name.length > 80) errors.push({ field: 'name', message: 'Keep the name under 80 characters' });
      else set.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!email) unset.email = 1;
      else if (email.includes('•') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'email', message: 'Enter a valid email' });
      else if (await Driver.exists({ email, _id: { $ne: driver._id } })) errors.push({ field: 'email', message: 'Another driver already uses this email' });
      else set.email = email;
    }
    if (body.dob !== undefined) {
      if (!body.dob) unset.dob = 1;
      else {
        const dob = new Date(`${String(body.dob).slice(0, 10)}T00:00:00Z`);
        const age = (Date.now() - dob.getTime()) / (365.25 * 86400000);
        if (Number.isNaN(dob.getTime())) errors.push({ field: 'dob', message: 'Enter a real date' });
        else if (age < 18 || age > 90) errors.push({ field: 'dob', message: 'Driver must be between 18 and 90 years old' });
        else set.dob = dob;
      }
    }
    if (body.gender !== undefined) {
      if (!body.gender) unset.gender = 1;
      else if (!['male', 'female', 'other'].includes(body.gender)) errors.push({ field: 'gender', message: 'Choose male, female or other' });
      else set.gender = body.gender;
    }
    if (body.address !== undefined) {
      const address = String(body.address ?? '').trim();
      if (address.length > 300) errors.push({ field: 'address', message: 'Keep the address under 300 characters' });
      else set.address = address;
    }
    if (body.dlNumber !== undefined) {
      const dl = String(body.dlNumber ?? '').trim().toUpperCase();
      if (!dl) unset['dlDetails.dlNumber'] = 1;
      else if (!/^[A-Z0-9 -]{6,20}$/.test(dl)) errors.push({ field: 'dlNumber', message: 'Use 6–20 letters, numbers, spaces or dashes' });
      else if (await Driver.exists({ 'dlDetails.dlNumber': dl, _id: { $ne: driver._id } })) errors.push({ field: 'dlNumber', message: 'Another driver already has this licence number' });
      else set['dlDetails.dlNumber'] = dl;
    }
    if (errors.length) return badRequest(res, errors);
    if (!Object.keys(set).length && !Object.keys(unset).length) return res.status(400).json({ message: 'Nothing to change' });

    const before = driver.toObject();
    const updated = await Driver.findByIdAndUpdate(
      driver._id,
      { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) },
      { new: true, runValidators: true }
    ).select(DRIVER_HIDDEN).lean();

    const flat = (d) => ({ name: d.name, email: d.email, dob: d.dob, gender: d.gender, address: d.address, dlNumber: d.dlDetails?.dlNumber });
    const diff = diffFields(flat(before), flat(updated), ['name', 'email', 'dob', 'gender', 'address', 'dlNumber']);
    await recordAudit(req, { action: 'driver.update', entity: 'driver', entityId: driver._id, ...diff });
    return res.status(200).json(maskPerson(req, updated));
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
      Review.find(filter).populate('userId', 'name phoneNumber').sort(sortParams(req.query, { createdAt: 'createdAt', rating: 'rating' }, { createdAt: -1 })).skip(skip).limit(limit).lean(),
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
        .sort(sortParams(req.query, { fare: 'fare', status: 'requestStatus', at: 'createdAt' }, { createdAt: -1 }))
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

    const oldestFirst = status === 'pending' ? { 'manualKyc.submittedAt': 1, updatedAt: 1 } : { updatedAt: -1 };
    const sort = sortParams(
      req.query,
      { driver: 'name', submitted: ['manualKyc.submittedAt', 'updatedAt'], reviewed: ['manualKyc.reviewedAt', 'updatedAt'], method: 'kycMethod' },
      oldestFirst
    );
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
    return res.status(200).json({
      case: maskPerson(req, kycCase(req, driver)),
      kyc: kycProgress(driver),
      onboarding: onboardingProgress(driver),
      vehicle,
      missingDocuments: missingKycDocuments(driver),
    });
  });

  // PATCH /admin/kyc/:id/complete  { reason?, confirmMissingDocs? }
  // Marks a driver's KYC verified regardless of method or current state (other than already
  // verified). When documents are missing the first call answers 409 DOCUMENTS_MISSING with the
  // list; the portal asks "are you sure?" and repeats with confirmMissingDocs: true + a reason.
  kycComplete = handle('complete KYC', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const driver = await Driver.findById(id).lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (driver.kycStatus === 'verified') {
      return res.status(409).json({ message: 'KYC is already completed for this driver', kyc: kycProgress(driver) });
    }

    const missing = missingKycDocuments(driver);
    const confirmed = req.body?.confirmMissingDocs === true;
    if (missing.length && !confirmed) {
      return res.status(409).json({
        code: 'DOCUMENTS_MISSING',
        message: 'Some KYC documents are missing. Confirm to complete KYC without them.',
        missingDocuments: missing,
      });
    }

    const errors = [];
    const reason = readReason(req.body, errors, { required: missing.length > 0 });
    if (errors.length) return badRequest(res, errors);

    // Matched on the status read above so two admins clicking at once cannot both write.
    const updated = await Driver.findOneAndUpdate(
      { _id: driver._id, kycStatus: driver.kycStatus ?? null },
      {
        $set: {
          kycStatus: 'verified',
          isKycCompleted: true,
          kycFailedReason: '',
          kycMethod: driver.kycMethod || 'manual',
          'manualKyc.reviewedAt': new Date(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: 'KYC changed while you were reviewing it. Reload and try again.' });

    notifyDriver(updated._id, 'kyc:verified', {});
    await recordAudit(req, {
      action: missing.length ? 'kyc.complete_without_documents' : 'kyc.complete',
      entity: 'driver',
      entityId: updated._id,
      before: { kycStatus: driver.kycStatus, kycMethod: driver.kycMethod || null },
      after: { kycStatus: 'verified', missingDocuments: missing.map((m) => m.label) },
      reason,
    });
    return res.status(200).json({ message: 'KYC marked as completed', kyc: kycProgress(updated), missingDocuments: missing });
  });

  // PATCH /admin/kyc/:id/status  { status, reason?, confirmMissingDocs? }
  // Sets a driver's KYC to any status from the driver profile.
  //   verified     same rules as /complete: missing documents need confirmMissingDocs + a reason
  //   rejected     reason required — it is what the driver is shown
  //   pending      back into the manual review queue; needs both Aadhaar photos on file
  //   not_started  a full reset, so the driver starts KYC again
  // Every move except "to verified with all documents" needs a reason. Moving a verified driver
  // to anything else also takes them offline, because they no longer pass the go-online check.
  kycSetStatus = handle('change KYC status', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid driver id' });
    const status = req.body?.status;
    if (!KYC_STATUSES.includes(status)) {
      return badRequest(res, [{ field: 'status', message: `Choose one of: ${KYC_STATUSES.join(', ')}` }]);
    }
    const driver = await Driver.findById(id).lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const current = driver.kycStatus || 'not_started';
    if (current === status) return res.status(409).json({ message: `KYC is already ${status.replace('_', ' ')}` });

    const missing = missingKycDocuments(driver);
    if (status === 'verified' && missing.length && req.body?.confirmMissingDocs !== true) {
      return res.status(409).json({
        code: 'DOCUMENTS_MISSING',
        message: 'Some KYC documents are missing. Confirm to complete KYC without them.',
        missingDocuments: missing,
      });
    }

    const errors = [];
    const needsReason = !(status === 'verified' && !missing.length);
    const reason = readReason(req.body, errors, { required: needsReason });
    if (status === 'pending' && !(driver.manualKyc?.aadhaarFrontImageUrl && driver.manualKyc?.aadhaarBackImageUrl)) {
      errors.push({ field: 'status', message: 'Pending review needs both Aadhaar photos. Reset to “not started” so the driver can upload them.' });
    }
    if (errors.length) return badRequest(res, errors);

    const set = { kycStatus: status, isKycCompleted: status === 'verified' };
    const unset = {};
    if (status === 'verified') {
      Object.assign(set, { kycFailedReason: '', kycMethod: driver.kycMethod || 'manual', 'manualKyc.reviewedAt': new Date() });
    } else if (status === 'rejected') {
      Object.assign(set, { kycFailedReason: reason, 'manualKyc.reviewedAt': new Date() });
    } else if (status === 'pending') {
      Object.assign(set, { kycFailedReason: '', kycMethod: 'manual', 'manualKyc.submittedAt': driver.manualKyc?.submittedAt || new Date() });
      unset['manualKyc.reviewedAt'] = 1;
    } else {
      Object.assign(set, { kycFailedReason: '', kycMethod: null });
    }

    const updated = await Driver.findOneAndUpdate(
      { _id: driver._id, kycStatus: driver.kycStatus ?? null },
      { $set: set, ...(Object.keys(unset).length && { $unset: unset }) },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: 'KYC changed while you were editing it. Reload and try again.' });

    if (current === 'verified') await enforceBlock('driver', updated._id); // offline + socket closed; not blocked
    if (status === 'verified') notifyDriver(updated._id, 'kyc:verified', {});
    if (status === 'rejected') notifyDriver(updated._id, 'kyc:rejected', { reason });

    await recordAudit(req, {
      action: status === 'verified' && missing.length ? 'kyc.complete_without_documents' : `kyc.set_${status}`,
      entity: 'driver',
      entityId: updated._id,
      before: { kycStatus: current, kycMethod: driver.kycMethod || null },
      after: { kycStatus: status, kycMethod: updated.kycMethod || null, ...(status === 'verified' && missing.length && { missingDocuments: missing.map((m) => m.label) }) },
      reason,
    });
    return res.status(200).json({ message: `KYC set to ${status.replace('_', ' ')}`, kyc: kycProgress(updated), missingDocuments: missing });
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
