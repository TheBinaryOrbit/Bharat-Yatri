import { env } from '../config/env.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { QuickRideBidService } from '../services/quickRideBid.service.js';
import { DriverAvailabilityService } from '../services/driverAvailability.service.js';
import { FareService } from '../services/fare.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';
import { openRideRoom } from '../socket/rideRoom.js';

export class QuickRideBidController {
  constructor() {
    this.quickRideService = new QuickRideService();
    this.quickRideBidService = new QuickRideBidService();
    this.driverAvailabilityService = new DriverAvailabilityService();
    this.fareService = new FareService();
    this.vehicleService = new VehicleService();
  }

  buildTrackingUrl = (trackingToken) => {
    if (!trackingToken) return null;
    return env.TRACKING_LINK_BASE_URL ? `${env.TRACKING_LINK_BASE_URL}/${trackingToken}` : trackingToken;
  };

  // POST /api/v3/quick-ride-bids  (protected — driver only)
  createBid = async (req, res) => {
    // Driver is taken from the auth token, never the request body
    const requestedBy = req.user._id;
    const { quickRideId } = req.body;
    const fare = Number(req.body.fare);

    const errors = [];
    if (!quickRideId) errors.push({ field: 'quickRideId', message: 'Ride is required' });
    if (!Number.isFinite(fare) || fare <= 0) errors.push({ field: 'fare', message: 'A valid fare is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      // The gate that actually matters. Dispatch already filters busy drivers, but that is
      // advisory — a stale ride card, a replayed request or a direct API call is stopped here.
      if (!(await this.driverAvailabilityService.isDriverAvailable(requestedBy))) {
        return res.status(409).json({ message: 'You already have an active ride. Finish it before bidding again.' });
      }

      const ride = await this.quickRideService.getRideRaw(quickRideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

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
      // accepted can undercut themselves to win the ride; they cannot walk the price up.
      const existing = await this.quickRideBidService.getActiveBidByDriver(ride._id, requestedBy);
      if (existing && fare >= existing.fare) {
        return res.status(400).json({
          message: `You can only lower your existing bid of ${existing.fare}`,
          currentBid: existing.fare,
        });
      }

      const bid = await this.quickRideBidService.placeBid({
        quickRideId: ride._id,
        requestedBy,
        vehicleId: vehicle._id,
        fare,
      });

      if (existing) {
        emitToUser(ride.bookedBy, 'bid:removed', {
          bidId: String(existing._id),
          quickRideId: String(ride._id),
        });
      }

      const populated = await this.quickRideBidService.getBidByIdPopulated(bid._id);
      emitToUser(ride.bookedBy, 'bid:new', { quickRideId: String(ride._id), bid: populated });

      return res.status(201).json({ message: 'Bid placed successfully.', bid: populated });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to place bid', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-ride-bids/:id/accept  (protected — user only)
  acceptBid = async (req, res) => {
    try {
      const bid = await this.quickRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      const ride = await this.quickRideService.getRideRaw(bid.quickRideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      if (bid.requestStatus !== 'pending' || bid.expiresAt <= new Date()) {
        return res.status(409).json({ message: 'This bid has expired' });
      }

      // Assign FIRST — the conditional update is the lock. If the sweeper expired the ride a
      // moment earlier, or another accept already won, this returns null and the rider gets a
      // clean 409 rather than a half-assigned ride. Only then do we touch the bids.
      const assigned = await this.quickRideService.assignRide(ride._id, {
        assignedTo: bid.requestedBy,
        acceptedBidId: bid._id,
        finalFare: bid.fare,
      });

      if (!assigned) {
        return res.status(409).json({ message: 'This ride is no longer available' });
      }

      const accepted = await this.quickRideBidService.acceptBid(bid._id);

      // Losing bids are deleted, not marked rejected
      const losers = await this.quickRideBidService.deleteOtherBidsForRide(ride._id, bid._id);
      losers.forEach((loser) =>
        emitToDriver(loser.requestedBy, 'ride:taken', { rideId: String(ride._id), bidId: String(loser._id) })
      );

      // The winner is now busy, so their bids on other rides can never be fulfilled.
      // Those riders are told immediately instead of watching a dead bid sit for 60s.
      const orphaned = await this.quickRideBidService.deleteDriverBidsOnOtherRides(bid.requestedBy, ride._id);
      orphaned.forEach((stale) => {
        const riderId = stale.quickRideId?.bookedBy;
        if (riderId) {
          emitToUser(riderId, 'bid:removed', {
            bidId: String(stale._id),
            quickRideId: String(stale.quickRideId?._id ?? stale.quickRideId),
          });
        }
      });

      await openRideRoom(assigned);

      const full = await this.quickRideService.getRideById(assigned._id);

      // Two payloads, built separately: the rider's carries the start OTP and the tracking link,
      // the driver's must carry neither.
      emitToUser(assigned.bookedBy, 'ride:assigned', {
        rideId: String(assigned._id),
        ride: full,
        startOtp: assigned.startOtp,
        trackingUrl: this.buildTrackingUrl(assigned.trackingToken),
        finalFare: assigned.finalFare,
      });

      emitToDriver(assigned.assignedTo, 'bid:accepted', {
        rideId: String(assigned._id),
        ride: full,
        finalFare: assigned.finalFare,
      });

      return res.status(200).json({
        message: 'Bid accepted successfully.',
        ride: full,
        bid: accepted,
        startOtp: assigned.startOtp,
        trackingUrl: this.buildTrackingUrl(assigned.trackingToken),
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to accept bid', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/quick-ride-bids/:id  (protected — user only)
  // The rider dismisses a bid. The ride stays open and that driver may bid again, lower.
  rejectBid = async (req, res) => {
    try {
      const bid = await this.quickRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      const ride = await this.quickRideService.getRideRaw(bid.quickRideId);
      if (!ride || String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      if (bid.requestStatus === 'accepted') {
        return res.status(409).json({ message: 'An accepted bid cannot be dismissed. Cancel the ride instead.' });
      }

      await this.quickRideBidService.deleteBid(bid._id);

      emitToDriver(bid.requestedBy, 'bid:removed', {
        bidId: String(bid._id),
        quickRideId: String(ride._id),
      });

      return res.status(200).json({ message: 'Bid dismissed successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to dismiss bid', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/quick-ride-bids/:id/withdraw  (protected — driver only)
  withdrawBid = async (req, res) => {
    try {
      const bid = await this.quickRideBidService.getBidById(req.params.id);
      if (!bid) return res.status(404).json({ message: 'Bid not found' });

      if (String(bid.requestedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this bid belongs to another driver' });
      }

      if (bid.requestStatus === 'accepted') {
        return res.status(409).json({ message: 'An accepted bid cannot be withdrawn. Cancel the ride instead.' });
      }

      await this.quickRideBidService.deleteBid(bid._id);

      const ride = await this.quickRideService.getRideRaw(bid.quickRideId);
      if (ride) {
        emitToUser(ride.bookedBy, 'bid:removed', {
          bidId: String(bid._id),
          quickRideId: String(ride._id),
        });
      }

      return res.status(200).json({ message: 'Bid withdrawn successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to withdraw bid', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-ride-bids/my  (protected — driver only)
  getMyBids = async (req, res) => {
    try {
      const bids = await this.quickRideBidService.getActiveBidsForDriver(req.user._id);
      return res.status(200).json({ count: bids.length, data: bids });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch bids', message: 'Internal server error' });
    }
  };
}
