import { QuickRide } from '../models/quickRide.model.js';
import { ACTIVE_RIDE_STATUSES, CANCELLABLE_RIDE_STATUSES } from '../constants/ride.constants.js';
import { generateStartOtp, generateTrackingToken } from '../utils/generateOtp.js';
import { withHistoryFilters } from '../utils/historyFilters.js';

// Not shared with the outstation service on purpose: these name collection-specific ref paths and
// projections, and they will drift the moment one module wants a different shape.
const RIDE_POPULATE = [
  { path: 'vehicleTypeId' },
  { path: 'assignedTo', select: 'name phoneNumber profileImageUrl' },
  { path: 'bookedBy', select: 'name phoneNumber profileImageUrl' },
];

export class QuickRideService {
  createRide = async (data) => {
    return QuickRide.create(data);
  };

  getRideById = async (id) => {
    return QuickRide.findById(id).populate(RIDE_POPULATE);
  };

  // Raw document, no populate — for internal checks where the refs aren't needed.
  getRideRaw = async (id) => {
    return QuickRide.findById(id);
  };

  // The rider-only read that deliberately opts into the OTP.
  getRideWithOtp = async (id) => {
    return QuickRide.findById(id).select('+startOtp').populate(RIDE_POPULATE);
  };

  getRideByTrackingToken = async (trackingToken) => {
    return QuickRide.findOne({ trackingToken, rideStatus: { $in: ACTIVE_RIDE_STATUSES } })
      .populate('vehicleTypeId')
      .populate('assignedTo', 'name profileImageUrl');
  };

  // Ride history, newest first. `filters` is optional: { statuses, createdAt } as built by the
  // controller — an absent filter simply narrows nothing.
  getRidesForUser = async (userId, filters) => {
    return QuickRide.find(withHistoryFilters({ bookedBy: userId }, filters))
      .sort({ createdAt: -1 })
      .populate(RIDE_POPULATE);
  };

  getRidesForDriver = async (driverId, filters) => {
    return QuickRide.find(withHistoryFilters({ assignedTo: driverId }, filters))
      .sort({ createdAt: -1 })
      .populate(RIDE_POPULATE);
  };

  // A rider may only have one ride out for bids at a time.
  getSearchingRideForUser = async (userId) => {
    return QuickRide.findOne({ bookedBy: userId, rideStatus: 'searching', expiresAt: { $gt: new Date() } });
  };

  // The ride a driver is currently committed to, if any.
  getActiveRideForDriver = async (driverId) => {
    return QuickRide.findOne({ assignedTo: driverId, rideStatus: { $in: ACTIVE_RIDE_STATUSES } });
  };

  // What a reopened app has to show. Wider than "active" for the rider: a ride still out for bids
  // is very much live to them, so 'searching' counts here and does not in ACTIVE_RIDE_STATUSES.
  // The OTP is selected in because the rider's own live view is the one place it is meant to show.
  getLiveRideForUser = async (userId) => {
    return QuickRide.findOne({
      bookedBy: userId,
      $or: [
        { rideStatus: 'searching', expiresAt: { $gt: new Date() } },
        { rideStatus: { $in: ACTIVE_RIDE_STATUSES } },
      ],
    })
      .sort({ createdAt: -1 })
      .select('+startOtp')
      .populate(RIDE_POPULATE);
  };

  getLiveRideForDriver = async (driverId) => {
    return QuickRide.findOne({ assignedTo: driverId, rideStatus: { $in: ACTIVE_RIDE_STATUSES } })
      .sort({ createdAt: -1 })
      .populate(RIDE_POPULATE);
  };

  // The active ride an identity participates in, either side. Used to rejoin a ride room on reconnect.
  getActiveRideForParticipant = async (id) => {
    return QuickRide.findOne({
      $or: [{ assignedTo: id }, { bookedBy: id }],
      rideStatus: { $in: ACTIVE_RIDE_STATUSES },
    });
  };

  // Open rides a driver could bid on, nearest first.
  findOpenRidesNear = async ({ latitude, longitude, vehicleTypeId, radiusKm }) => {
    return QuickRide.aggregate([
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
          },
        },
      },
      { $sort: { distanceFromDriverMeters: 1 } },
      { $limit: 50 },
    ]);
  };

  // Claims the ride for a driver.
  //
  // The rideStatus/expiresAt predicate IS the concurrency lock — two riders accepting different
  // bids on the same ride cannot both win, and the sweeper expiring the ride a moment earlier
  // makes this return null rather than half-assigning. Never read-then-write here.
  assignRide = async (rideId, { assignedTo, acceptedBidId, finalFare }) => {
    return QuickRide.findOneAndUpdate(
      { _id: rideId, rideStatus: 'searching', expiresAt: { $gt: new Date() } },
      {
        rideStatus: 'assigned',
        assignedTo,
        acceptedBidId,
        finalFare,
        startOtp: generateStartOtp(),
        trackingToken: generateTrackingToken(),
      },
      { new: true }
    ).select('+startOtp');
  };

  // Starts the trip. The OTP is matched inside the query predicate, so comparing it and
  // transitioning the ride are one atomic operation — there is no read-compare-write window,
  // and no code path that loads the OTP into memory to compare it.
  startRide = async (rideId, driverId, startOtp) => {
    return QuickRide.findOneAndUpdate(
      { _id: rideId, assignedTo: driverId, rideStatus: 'assigned', startOtp: String(startOtp) },
      { rideStatus: 'in_progress', startedAt: new Date() },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  recordFailedStartOtp = async (rideId) => {
    return QuickRide.findByIdAndUpdate(rideId, { $inc: { startOtpAttempts: 1 } }, { new: true });
  };

  completeRide = async (rideId, driverId) => {
    return QuickRide.findOneAndUpdate(
      { _id: rideId, assignedTo: driverId, rideStatus: 'in_progress' },
      { rideStatus: 'completed', completedAt: new Date(), trackingToken: null },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  cancelRide = async (rideId, { cancelledBy, cancellationReason }) => {
    return QuickRide.findOneAndUpdate(
      { _id: rideId, rideStatus: { $in: CANCELLABLE_RIDE_STATUSES } },
      { rideStatus: 'cancelled', cancelledBy, cancellationReason, trackingToken: null },
      { new: true }
    ).populate(RIDE_POPULATE);
  };

  // Raises the rider's offer. The `offeredFare: { $lt: newFare }` predicate enforces
  // increase-only in the query itself, so two concurrent raises cannot interleave into a lower value.
  raiseOfferedFare = async (rideId, userId, newFare) => {
    return QuickRide.findOneAndUpdate(
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

  findExpiredSearchingRides = async () => {
    return QuickRide.find({ rideStatus: 'searching', expiresAt: { $lte: new Date() } }).select(
      '_id bookedBy'
    );
  };

  markRidesExpired = async (rideIds) => {
    return QuickRide.updateMany(
      { _id: { $in: rideIds }, rideStatus: 'searching' },
      { rideStatus: 'expired', trackingToken: null }
    );
  };
}
