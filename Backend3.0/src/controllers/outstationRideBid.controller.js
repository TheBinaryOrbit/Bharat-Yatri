import { OutstationRideService } from '../services/outstationRide.service.js';
import { OutstationRideBidService } from '../services/outstationRideBid.service.js';
import { DriverAvailabilityService } from '../services/driverAvailability.service.js';
import { FareService } from '../services/fare.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { RideAudienceService } from '../services/rideAudience.service.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';

export class OutstationRideBidController {
  constructor() {
    this.outstationRideService = new OutstationRideService();
    this.outstationRideBidService = new OutstationRideBidService();
    this.driverAvailabilityService = new DriverAvailabilityService();
    this.fareService = new FareService();
    this.vehicleService = new VehicleService();
    this.rideAudienceService = new RideAudienceService();
  }

  // POST /api/v3/outstation-ride-bids  (protected — driver only)
  createBid = async (req, res) => {
    // Driver is taken from the auth token, never the request body
    const requestedBy = req.user._id;
    const { outstationRideId } = req.body;
    const fare = Number(req.body.fare);

    const errors = [];
    if (!outstationRideId) errors.push({ field: 'outstationRideId', message: 'Ride is required' });
    if (!Number.isFinite(fare) || fare <= 0) errors.push({ field: 'fare', message: 'A valid fare is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      // The gate that actually matters. Dispatch already filters ineligible drivers, but that is
      // advisory — a stale ride card, a replayed request or a direct API call is stopped here.
      // checkDriverAvailability rather than isDriverAvailable so the 409 can say WHICH rule bit:
      // "finish your current ride" and "you already have an outstation trip" are different
      // problems with different fixes.
      const availability = await this.driverAvailabilityService.checkDriverAvailability(requestedBy, {
        rideType: 'outstation',
      });

      if (!availability.available) {
        return res.status(409).json({ message: availability.message, reason: availability.reason });
      }

      const ride = await this.outstationRideService.getRideRaw(outstationRideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      // NOTE: there is deliberately NO `pickupAt > now` guard here. The obvious "don't bid on a
      // trip that has already left" check would break book-now entirely, because for
      // bookingType:'now' pickupAt is in the past by construction. expiresAt already encodes the
      // departure deadline for scheduled trips — it is capped at pickupAt at creation — so this
      // one check is the complete and correct gate for both.
      if (ride.rideStatus !== 'searching' || ride.expiresAt <= new Date()) {
        return res.status(409).json({ message: 'This ride is no longer accepting bids' });
      }

      const vehicle = await this.vehicleService.getVehicleByDriver(requestedBy);
      if (!vehicle) {
        return res.status(409).json({ message: 'Register a vehicle before bidding' });
      }

      const driverTypeId = String(vehicle.vehicleTypeId?._id ?? vehicle.vehicleTypeId);
      if (driverTypeId !== String(ride.vehicleTypeId)) {
        return res.status(409).json({ message: 'This ride is for a different vehicle type' });
      }

      const bounds = this.fareService.getBidBounds(ride.offeredFare);
      if (fare < bounds.min || fare > bounds.max) {
        return res.status(400).json({
          message: `Your bid must be between ${bounds.min} and ${bounds.max}`,
          bidBounds: bounds,
        });
      }

      // Re-bidding is allowed and expected — but only downwards. A driver whose bid was not
      // accepted can undercut themselves to win the trip; they cannot walk the price up.
      const existing = await this.outstationRideBidService.getActiveBidByDriver(ride._id, requestedBy);
      if (existing && fare >= existing.fare) {
        return res.status(400).json({
          message: `You can only lower your existing bid of ${existing.fare}`,
          currentBid: existing.fare,
        });
      }

      const bid = await this.outstationRideBidService.placeBid({
        outstationRideId: ride._id,
        requestedBy,
        vehicleId: vehicle._id,
        fare,
      });

      if (existing) {
        emitToUser(ride.bookedBy, 'outstation:bid_removed', {
          bidId: String(existing._id),
          outstationRideId: String(ride._id),
        });
      }

      const populated = await this.outstationRideBidService.getBidByIdPopulated(bid._id);
      emitToUser(ride.bookedBy, 'outstation:bid_new', { outstationRideId: String(ride._id), bid: populated });

      return res.status(201).json({ message: 'Bid placed successfully.', bid: populated });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to place bid', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/outstation-ride-bids/:id/accept  (protected — user only)
  acceptBid = async (req, res) => {
    try {
      const bid = await this.outstationRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      const ride = await this.outstationRideService.getRideRaw(bid.outstationRideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      // No expiry check — outstation bids do not expire. What replaces it is the availability
      // re-check below.
      if (bid.requestStatus !== 'pending') {
        return res.status(409).json({ message: 'This bid is no longer pending' });
      }

      // A QuickRide bid is at most 60 seconds old when it is accepted, so the driver who placed it
      // is almost certainly still free. An outstation bid has no expiry at all — this one may have
      // been sitting here since Tuesday, and in the meantime that driver may have won a different
      // trip. Re-checking at accept time is the only thing standing between the rider and a driver
      // who is already committed elsewhere. Their bid is deleted on the way out, so the rider's
      // list self-corrects instead of offering the same dead option again.
      const availability = await this.driverAvailabilityService.checkDriverAvailability(bid.requestedBy, {
        rideType: 'outstation',
      });

      if (!availability.available) {
        await this.outstationRideBidService.deleteBid(bid._id);
        emitToDriver(bid.requestedBy, 'outstation:bid_removed', {
          bidId: String(bid._id),
          outstationRideId: String(ride._id),
        });

        return res.status(409).json({
          message: 'This driver is no longer available. Their bid has been removed — please pick another.',
          reason: availability.reason,
        });
      }

      // Assign FIRST — the conditional update is the lock. If the sweeper expired the ride a
      // moment earlier, or another accept already won, this returns null and the rider gets a
      // clean 409 rather than a half-assigned ride. Only then do we touch the bids.
      //
      // Residual race, stated honestly: two riders accepting bids from the SAME driver in the same
      // millisecond both pass the availability check above. The window is milliseconds, and
      // deleteDriverBidsOnOtherRides below closes it for everything after.
      const assigned = await this.outstationRideService.assignRide(ride._id, {
        assignedTo: bid.requestedBy,
        acceptedBidId: bid._id,
        finalFare: bid.fare,
      });

      if (!assigned) {
        return res.status(409).json({ message: 'This ride is no longer available' });
      }

      const accepted = await this.outstationRideBidService.acceptBid(bid._id);

      // Losing bids are deleted, not marked rejected
      const losers = await this.outstationRideBidService.deleteOtherBidsForRide(ride._id, bid._id);
      losers.forEach((loser) =>
        emitToDriver(loser.requestedBy, 'outstation:ride_taken', {
          rideId: String(ride._id),
          bidId: String(loser._id),
        })
      );

      // The drivers who saw the card and never bid. They get the same event without a `bidId` —
      // there is no bid of theirs to reference. The winner is excluded for the obvious reason.
      await this.rideAudienceService.notifyAndDrain(
        ride._id,
        'outstation:ride_taken',
        { rideId: String(ride._id) },
        { exclude: [...losers.map((loser) => loser.requestedBy), bid.requestedBy] }
      );

      // The winner now holds their single outstation slot, so their bids on other trips can never
      // be fulfilled. This matters more here than on QuickRide: without an expiry sweep, a dead
      // bid would otherwise sit on the rider's screen indefinitely rather than for 60 seconds.
      const orphaned = await this.outstationRideBidService.deleteDriverBidsOnOtherRides(bid.requestedBy, ride._id);
      orphaned.forEach((stale) => {
        const riderId = stale.outstationRideId?.bookedBy;
        if (riderId) {
          emitToUser(riderId, 'outstation:bid_removed', {
            bidId: String(stale._id),
            outstationRideId: String(stale.outstationRideId?._id ?? stale.outstationRideId),
          });
        }
      });

      // No openRideRoom here — unlike QuickRide, accepting an outstation bid does NOT open the
      // tracking window. That happens when the driver taps start, which may be days from now, and
      // keeping the room shut until then is exactly what stops a scheduled trip streaming the
      // driver's position while they go about other work.

      const full = await this.outstationRideService.getRideById(assigned._id);

      // Two payloads, built separately: the rider's carries the start OTP, the driver's must not.
      // trackingUrl is null for both — there is nothing to track yet.
      emitToUser(assigned.bookedBy, 'outstation:assigned', {
        rideId: String(assigned._id),
        ride: full,
        startOtp: assigned.startOtp,
        trackingUrl: null,
        finalFare: assigned.finalFare,
        pickupAt: assigned.pickupAt,
      });

      emitToDriver(assigned.assignedTo, 'outstation:bid_accepted', {
        rideId: String(assigned._id),
        ride: full,
        finalFare: assigned.finalFare,
        pickupAt: assigned.pickupAt,
      });

      return res.status(200).json({
        message: 'Bid accepted successfully.',
        ride: full,
        bid: accepted,
        startOtp: assigned.startOtp,
        trackingUrl: null,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to accept bid', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/outstation-ride-bids/:id  (protected — user only)
  // The rider dismisses a bid. The ride stays open and that driver may bid again, lower.
  rejectBid = async (req, res) => {
    try {
      const bid = await this.outstationRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      const ride = await this.outstationRideService.getRideRaw(bid.outstationRideId);
      if (!ride || String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      if (bid.requestStatus === 'accepted') {
        return res.status(409).json({ message: 'An accepted bid cannot be dismissed. Cancel the ride instead.' });
      }

      await this.outstationRideBidService.deleteBid(bid._id);

      emitToDriver(bid.requestedBy, 'outstation:bid_removed', {
        bidId: String(bid._id),
        outstationRideId: String(ride._id),
      });

      return res.status(200).json({ message: 'Bid dismissed successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to dismiss bid', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/outstation-ride-bids/:id/withdraw  (protected — driver only)
  withdrawBid = async (req, res) => {
    try {
      const bid = await this.outstationRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      if (String(bid.requestedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this bid belongs to another driver' });
      }

      if (bid.requestStatus === 'accepted') {
        return res.status(409).json({ message: 'An accepted bid cannot be withdrawn. Cancel the ride instead.' });
      }

      await this.outstationRideBidService.deleteBid(bid._id);

      const ride = await this.outstationRideService.getRideRaw(bid.outstationRideId);
      if (ride) {
        emitToUser(ride.bookedBy, 'outstation:bid_removed', {
          bidId: String(bid._id),
          outstationRideId: String(ride._id),
        });
      }

      return res.status(200).json({ message: 'Bid withdrawn successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to withdraw bid', message: 'Internal server error' });
    }
  };

  // GET /api/v3/outstation-ride-bids/my  (protected — driver only)
  // No expiry filter — these bids live until something explicitly kills them, which is the whole
  // point: a driver bids on Tuesday for a trip on Friday and expects to still see it on Thursday.
  getMyBids = async (req, res) => {
    try {
      const bids = await this.outstationRideBidService.getActiveBidsForDriver(req.user._id);
      return res.status(200).json({ count: bids.length, data: bids });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch bids', message: 'Internal server error' });
    }
  };
}
