import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { QuickRideBid } from '../../models/quickRideBid.model.js';
import { OutstationRideBid } from '../../models/outstationRideBid.model.js';
import { User } from '../../models/user.model.js';
import { Driver } from '../../models/driver.model.js';
import { Vehicle } from '../../models/vehicle.model.js';
import { Review } from '../../models/review.model.js';
import { RIDE_STATUSES, OUTSTATION_RIDE_STATUSES, BOOKING_TYPES } from '../../constants/ride.constants.js';
import { LiveService } from '../../services/admin/live.service.js';
import { badRequest, containsRegex, dateFilter, handle, isId, listResponse, maskPerson, pageParams, sortParams, toId } from './helpers.js';
import { parseDateRange } from '../../utils/dateRange.js';

const liveService = new LiveService();

// One controller serves both products; everything that differs is in this table.
const KINDS = {
  quickride: {
    Ride: QuickRide,
    Bid: QuickRideBid,
    rideField: 'quickRideId',
    statuses: RIDE_STATUSES,
    active: ['assigned', 'in_progress'],
    label: 'Quick ride',
  },
  outstation: {
    Ride: OutstationRide,
    Bid: OutstationRideBid,
    rideField: 'outstationRideId',
    statuses: OUTSTATION_RIDE_STATUSES,
    active: ['arriving', 'in_progress'],
    label: 'Outstation ride',
  },
};

const timeline = (ride, kind) => {
  const steps = [{ key: 'created', label: 'Booked', at: ride.createdAt }];
  if (kind === 'outstation' && ride.bookingType === 'later') steps.push({ key: 'scheduled', label: 'Scheduled pickup', at: ride.pickupAt, planned: true });
  if (ride.assignedTo) steps.push({ key: 'assigned', label: 'Driver assigned', at: ride.acceptedBid?.updatedAt ?? null });
  if (ride.arrivingAt) steps.push({ key: 'arriving', label: 'Driver set off', at: ride.arrivingAt });
  if (ride.startedAt) steps.push({ key: 'started', label: kind === 'outstation' ? 'Picked up' : 'Ride started', at: ride.startedAt });
  if (ride.completedAt) steps.push({ key: 'completed', label: 'Completed', at: ride.completedAt });
  if (ride.rideStatus === 'cancelled') steps.push({ key: 'cancelled', label: `Cancelled by ${ride.cancelledBy || 'unknown'}`, at: ride.updatedAt, note: ride.cancellationReason || '' });
  if (ride.rideStatus === 'expired') steps.push({ key: 'expired', label: 'Expired — no driver accepted', at: ride.expiresAt });
  return steps;
};

export class RidesController {
  constructor(kind) {
    this.kind = kind;
    this.k = KINDS[kind];
  }

  // GET /admin/{quick|outstation}-rides?status=a,b&vehicleTypeId&from&to&tripFrom&tripTo&q&customerId&driverId&bookingType
  list = handle('load rides', async (req, res) => {
    const { Ride, Bid, rideField, statuses } = this.k;
    const { page, limit, skip } = pageParams(req.query);
    const errors = [];
    const createdAt = dateFilter(req.query, errors);
    const pickupAt = this.kind === 'outstation' ? parseDateRange({ from: req.query.tripFrom, to: req.query.tripTo }, errors) : null;

    const filter = {};
    if (req.query.status) {
      const list = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
      const bad = list.filter((s) => !statuses.includes(s));
      if (bad.length) errors.push({ field: 'status', message: `Unknown status: ${bad.join(', ')}` });
      else filter.rideStatus = { $in: list };
    }
    if (errors.length) return badRequest(res, errors);
    if (createdAt) filter.createdAt = createdAt;
    if (pickupAt) filter.pickupAt = pickupAt;
    if (isId(req.query.vehicleTypeId)) filter.vehicleTypeId = toId(req.query.vehicleTypeId);
    if (isId(req.query.customerId)) filter.bookedBy = toId(req.query.customerId);
    if (isId(req.query.driverId)) filter.assignedTo = toId(req.query.driverId);
    if (this.kind === 'outstation' && BOOKING_TYPES.includes(req.query.bookingType)) filter.bookingType = req.query.bookingType;

    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (isId(q)) {
        filter._id = toId(q);
      } else {
        const rx = containsRegex(q);
        const [users, drivers] = await Promise.all([
          User.find({ $or: [{ name: rx }, { phoneNumber: rx }] }).distinct('_id'),
          Driver.find({ $or: [{ name: rx }, { phoneNumber: rx }] }).distinct('_id'),
        ]);
        filter.$or = [{ bookedBy: { $in: users } }, { assignedTo: { $in: drivers } }, { pickupLocationName: rx }, { dropLocationName: rx }];
      }
    }

    const legacyField = this.kind === 'outstation' && req.query.sort === 'trip' ? 'pickupAt' : 'createdAt';
    const sort = sortParams(
      req.query,
      { ride: 'createdAt', pickupAt: 'pickupAt', fare: 'offeredFare', status: 'rideStatus' },
      { [legacyField]: -1 }
    );
    const [rows, total] = await Promise.all([
      Ride.find(filter)
        .populate('bookedBy', 'name phoneNumber')
        .populate('assignedTo', 'name phoneNumber')
        .populate('vehicleTypeId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Ride.countDocuments(filter),
    ]);

    const bidCounts = await Bid.aggregate([
      { $match: { [rideField]: { $in: rows.map((r) => r._id) } } },
      { $group: { _id: `$${rideField}`, count: { $sum: 1 } } },
    ]);
    const bidsBy = new Map(bidCounts.map((b) => [String(b._id), b.count]));

    const data = rows.map((r) => {
      maskPerson(req, r.bookedBy);
      maskPerson(req, r.assignedTo);
      return { ...r, bidCount: bidsBy.get(String(r._id)) || 0 };
    });
    return listResponse(res, { data, total, page, limit });
  });

  // GET /admin/{quick|outstation}-rides/:id — the ride, every bid on it, the timeline
  detail = handle('load ride', async (req, res) => {
    const { Ride, Bid, rideField, active } = this.k;
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid ride id' });

    // startOtp is select:false on the schema and is never opted into here.
    const ride = await Ride.findById(id)
      .populate('bookedBy', 'name phoneNumber profileImageUrl isBlocked')
      .populate('assignedTo', 'name phoneNumber profileImageUrl isBlocked')
      .populate('vehicleTypeId', 'name slug baseFare ratePerKm ratePerMinute')
      .lean();
    if (!ride) return res.status(404).json({ message: `${this.k.label} not found` });

    const bids = await Bid.find({ [rideField]: ride._id })
      .populate('requestedBy', 'name phoneNumber profileImageUrl')
      .populate({ path: 'vehicleId', select: 'vehicleNumber vehicleName vehicleTypeId', populate: { path: 'vehicleTypeId', select: 'name' } })
      .sort({ createdAt: 1 })
      .lean();
    bids.forEach((b) => {
      b.isAccepted = ride.acceptedBidId ? String(ride.acceptedBidId) === String(b._id) : b.requestStatus === 'accepted';
      maskPerson(req, b.requestedBy);
    });
    ride.acceptedBid = bids.find((b) => b.isAccepted) || null;

    const [driverVehicle, review, live] = await Promise.all([
      ride.assignedTo ? Vehicle.findOne({ driverId: ride.assignedTo._id }).populate('vehicleTypeId', 'name').lean() : null,
      ride.assignedTo && ride.bookedBy
        ? Review.findOne({ userId: ride.bookedBy._id, driverId: ride.assignedTo._id }).lean()
        : null,
      ride.assignedTo && active.includes(ride.rideStatus) ? liveService.driverLiveState(ride.assignedTo._id).catch(() => null) : null,
    ]);

    maskPerson(req, ride.bookedBy);
    maskPerson(req, ride.assignedTo);
    delete ride.trackingToken; // a live credential — the portal has no use for it

    return res.status(200).json({
      rideType: this.kind,
      ride,
      bids,
      bidNote:
        this.kind === 'quickride'
          ? 'Quick ride bids are deleted 60 seconds after they are placed unless accepted, so finished rides usually show only the winning bid.'
          : 'Outstation bids stay until accepted, withdrawn or the ride ends; losing bids are removed when one is accepted.',
      driverVehicle,
      review,
      live,
      timeline: timeline(ride, this.kind),
    });
  });
}
