import { OutstationRide } from '../models/outstationRide.model.js';
import {
  OUTSTATION_ACTIVE_RIDE_STATUSES,
  OUTSTATION_CANCELLABLE_RIDE_STATUSES,
  OUTSTATION_TRACKABLE_RIDE_STATUSES,
} from '../constants/ride.constants.js';
import { generateStartOtp, generateTrackingToken } from '../utils/generateOtp.js';
import { withHistoryFilters } from '../utils/historyFilters.js';

// Not shared with the QuickRide service on purpose: these name collection-specific ref paths and
// projections, and they will drift the moment one module wants a different shape.
const RIDE_POPULATE = [
  { path: 'vehicleTypeId' },
  { path: 'assignedTo', select: 'name phoneNumber profileImageUrl' },
  { path: 'bookedBy', select: 'name phoneNumber profileImageUrl' },
];

export class OutstationRideService {
  createRide = async (data) => {
    return OutstationRide.create(data);
  };

  getRideById = async (id) => {
    return OutstationRide.findById(id).populate(RIDE_POPULATE);
  };

  // Raw document, no populate — for internal checks where the refs aren't needed.
  getRideRaw = async (id) => {
    return OutstationRide.findById(id);
  };

  // The rider-only read that deliberately opts into the OTP.
  getRideWithOtp = async (id) => {
    return OutstationRide.findById(id).select('+startOtp').populate(RIDE_POPULATE);
  };

  // 'arriving' only — NOT the full active list. An outstation share link covers the approach and
  // nothing else; the token is nulled at pickup, so an in_progress row could not match anyway, but
  // naming the status here makes the invariant explicit instead of leaning on a field being
  // cleared elsewhere.
  getRideByTrackingToken = async (trackingToken) => {
    return OutstationRide.findOne({
      trackingToken,
      rideStatus: { $in: OUTSTATION_TRACKABLE_RIDE_STATUSES },
    })
      .populate('vehicleTypeId')
      .populate('assignedTo', 'name profileImageUrl');
  };

  // Ride history. `dateField` decides what a date filter means and what the list is ordered by:
  // 'createdAt' is when the trip was booked, 'pickupAt' is when it leaves — and for a scheduled
  // product the second is usually the more useful question. Both are indexed.
  getRidesForUser = async (userId, filters, dateField = 'createdAt') => {
    return OutstationRide.find(withHistoryFilters({ bookedBy: userId }, filters, dateField))
      .sort({ [dateField]: -1 })
      .populate(RIDE_POPULATE);
  };

  getRidesForDriver = async (driverId, filters, dateField = 'createdAt') => {
    return OutstationRide.find(withHistoryFilters({ assignedTo: driverId }, filters, dateField))
      .sort({ [dateField]: -1 })
      .populate(RIDE_POPULATE);
  };

  // Has this rider ever finished a trip with this driver? The gate on leaving a review — the
  // outstation half of it, asked alongside the QuickRide one. Covered by the
  // {assignedTo, rideStatus, pickupAt} index, whose first two fields are exactly this predicate.
  hasCompletedRideTogether = async (userId, driverId) => {
    return OutstationRide.exists({ bookedBy: userId, assignedTo: driverId, rideStatus: 'completed' });
  };

  // Drop locations from this rider's recent bookings, for the search bar's suggestions.
  // Ordered by createdAt, not pickupAt: a suggestion is about what the rider last searched for,
  // and a trip booked this morning for next month is the more recent intention.
  getRecentDropLocations = async (userId, limit) => {
    return OutstationRide.find({ bookedBy: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('dropLocationName dropCoordinates createdAt');
  };

  // Plural, unlike QuickRide's single-ride equivalent. A QuickRide rider is hailing and two open
  // hails is a double-tap; an outstation rider is planning, and next Friday's trip and next
  // month's trip are two intentions that must be able to sit out for bids at the same time.
  getSearchingRidesForUser = async (userId) => {
    return OutstationRide.find({
      bookedBy: userId,
      rideStatus: 'searching',
      expiresAt: { $gt: new Date() },
    }).sort({ pickupAt: 1 });
  };

  // The ride a driver is currently committed to, if any. One at a time, by rule.
  getActiveRideForDriver = async (driverId) => {
    return OutstationRide.findOne({
      assignedTo: driverId,
      rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES },
    });
  };

  // What a reopened app has to show the rider — an ARRAY, soonest departure first. Wider than
  // "active": a ride still out for bids is very much live to them.
  getLiveRidesForUser = async (userId) => {
    return OutstationRide.find({
      bookedBy: userId,
      $or: [
        { rideStatus: 'searching', expiresAt: { $gt: new Date() } },
        { rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES } },
      ],
    })
      .sort({ pickupAt: 1 })
      .select('+startOtp')
      .populate(RIDE_POPULATE);
  };

  getLiveRideForDriver = async (driverId) => {
    return OutstationRide.findOne({
      assignedTo: driverId,
      rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES },
    })
      .sort({ pickupAt: 1 })
      .populate(RIDE_POPULATE);
  };

  // The ride an identity has a ROOM in, either side — used to rejoin on reconnect.
  //
  // Named for rooms rather than "active" because here the two are not the same thing: an outstation
  // ride is active from assignment to completion, but only has a room while 'arriving'. A method
  // called getActiveRideForParticipant that quietly excluded in_progress would be a trap.
  getRoomEligibleRideForParticipant = async (id) => {
    return OutstationRide.findOne({
      $or: [{ assignedTo: id }, { bookedBy: id }],
      rideStatus: { $in: OUTSTATION_TRACKABLE_RIDE_STATUSES },
    });
  };

  // Open rides a driver could bid on. Sorted by departure first and distance second: a driver
  // browsing outstation work is picking a trip to commit a day to, not the nearest pickup.
  findOpenRidesNear = async ({ latitude, longitude, vehicleTypeId, radiusKm, bookingType }) => {
    return OutstationRide.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceFromDriverMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: {
            rideStatus: 'searching',
            expiresAt: { $gt: new Date() },
            vehicleTypeId,
            ...(bookingType && { bookingType }),
          },
        },
      },
      { $sort: { pickupAt: 1, distanceFromDriverMeters: 1 } },
      { $limit: 50 },
    ]);
  };

  // Claims the ride for a driver.
  //
  // The rideStatus/expiresAt predicate IS the concurrency lock — two riders accepting different
  // bids on the same ride cannot both win, and the sweeper expiring the ride a moment earlier
  // makes this return null rather than half-assigning. Never read-then-write here.
  //
  // Only the OTP is minted here, not a tracking token: an outstation ride may sit assigned for
  // days before the driver sets off, and a link that resolves for three days while the driver goes
  // about other work is exactly what the narrow tracking window exists to prevent.
  assignRide = async (rideId, { assignedTo, acceptedBidId, finalFare }) => {
    return OutstationRide.findOneAndUpdate(
      { _id: rideId, rideStatus: 'searching', expiresAt: { $gt: new Date() } },
      {
        rideStatus: 'assigned',
        assignedTo,
        acceptedBidId,
        finalFare,
        startOtp: generateStartOtp(),
      },
      { new: true }
    ).select('+startOtp');
  };

  // The driver sets off for pickup. No OTP — the rider is not here yet.
  //
  // This is where the tracking window OPENS: the token is minted in the same atomic update that
  // moves the ride to 'arriving', so it can never exist in a status that would not honour it.
  startRide = async (rideId, driverId) => {
    return OutstationRide.findOneAndUpdate(
      { _id: rideId, assignedTo: driverId, rideStatus: 'assigned' },
      { rideStatus: 'arriving', arrivingAt: new Date(), trackingToken: generateTrackingToken() },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  // The rider is aboard — and the tracking window shuts in the same breath.
  //
  // The OTP is matched inside the query predicate, so comparing it and transitioning the ride are
  // one atomic operation; no code path loads the OTP into memory to compare it. Nulling
  // trackingToken HERE rather than in a follow-up write is the other half: two separate writes
  // would leave a window where the ride is in_progress and the token still resolves — small, but
  // exactly the window a leaked link would be used in. The controller closes the room right after.
  pickupRide = async (rideId, driverId, startOtp) => {
    return OutstationRide.findOneAndUpdate(
      { _id: rideId, assignedTo: driverId, rideStatus: 'arriving', startOtp: String(startOtp) },
      { rideStatus: 'in_progress', startedAt: new Date(), trackingToken: null },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  recordFailedStartOtp = async (rideId) => {
    return OutstationRide.findByIdAndUpdate(rideId, { $inc: { startOtpAttempts: 1 } }, { new: true });
  };

  completeRide = async (rideId, driverId) => {
    return OutstationRide.findOneAndUpdate(
      { _id: rideId, assignedTo: driverId, rideStatus: 'in_progress' },
      { rideStatus: 'completed', completedAt: new Date(), trackingToken: null },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  cancelRide = async (rideId, { cancelledBy, cancellationReason }) => {
    return OutstationRide.findOneAndUpdate(
      { _id: rideId, rideStatus: { $in: OUTSTATION_CANCELLABLE_RIDE_STATUSES } },
      { rideStatus: 'cancelled', cancelledBy, cancellationReason, trackingToken: null },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  // Raises the rider's offer. The `offeredFare: { $lt: newFare }` predicate enforces increase-only
  // in the query itself, so two concurrent raises cannot interleave into a lower value.
  raiseOfferedFare = async (rideId, userId, newFare) => {
    return OutstationRide.findOneAndUpdate(
      {
        _id: rideId,
        bookedBy: userId,
        rideStatus: 'searching',
        expiresAt: { $gt: new Date() },
        offeredFare: { $lt: newFare },
      },
      { offeredFare: newFare, $inc: { fareUpdateCount: 1 } },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  // Trips leaving inside the reminder horizon, for the departure-ladder sweeper.
  //
  // 'assigned' only, and that is the whole gate. A driver who has already tapped "on my way" is at
  // 'arriving' and does not need telling; a trip still 'searching' has nobody to tell. Served by
  // the {rideStatus, vehicleTypeId, pickupAt} index on its first field, and by {pickupAt} for the
  // range — a sweep over a handful of upcoming trips either way.
  findRidesDueForReminder = async (horizonMinutes) => {
    const now = new Date();

    return OutstationRide.find({
      rideStatus: 'assigned',
      pickupAt: { $gt: now, $lte: new Date(now.getTime() + horizonMinutes * 60 * 1000) },
    }).select('_id assignedTo pickupAt pickupLocationName dropLocationName');
  };

  findExpiredSearchingRides = async () => {
    return OutstationRide.find({ rideStatus: 'searching', expiresAt: { $lte: new Date() } }).select(
      '_id bookedBy'
    );
  };

  markRidesExpired = async (rideIds) => {
    return OutstationRide.updateMany(
      { _id: { $in: rideIds }, rideStatus: 'searching' },
      { rideStatus: 'expired', trackingToken: null }
    );
  };
}
