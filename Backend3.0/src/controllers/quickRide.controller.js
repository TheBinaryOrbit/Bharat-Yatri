import { env } from '../config/env.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { QuickRideBidService } from '../services/quickRideBid.service.js';
import { DriverAvailabilityService } from '../services/driverAvailability.service.js';
import { DriverLocationService } from '../services/driverLocation.service.js';
import { RideDispatchService } from '../services/rideDispatch.service.js';
import { RideAudienceService } from '../services/rideAudience.service.js';
import { PaymentDetailsService } from '../services/paymentDetails.service.js';
import { DriverProfileService } from '../services/driverProfile.service.js';
import { FareService } from '../services/fare.service.js';
import { MapsService, RouteNotFoundError } from '../services/maps.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { VehicleTypeService } from '../services/vehicleType.service.js';
import { resolveVehicleType } from '../utils/resolveVehicleType.js';
import { isValidCoordinate, toGeoPoint, fromGeoPoint } from '../utils/geo.js';
import { parseDateRange } from '../utils/dateRange.js';
import { validateCoordinates, parseRideStatuses } from '../utils/validate.js';
import { buildTrackingUrl } from '../utils/trackingUrl.js';
import { RIDE_STATUSES } from '../constants/ride.constants.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';
import { notifyDriver, notifyUser } from '../notifications/index.js';
import { openRideRoom, closeRideRoom } from '../socket/rideRoom.js';

export class QuickRideController {
  constructor() {
    this.quickRideService = new QuickRideService();
    this.quickRideBidService = new QuickRideBidService();
    this.driverAvailabilityService = new DriverAvailabilityService();
    this.driverLocationService = new DriverLocationService();
    this.rideDispatchService = new RideDispatchService();
    this.rideAudienceService = new RideAudienceService();
    this.fareService = new FareService();
    this.mapsService = new MapsService();
    this.vehicleService = new VehicleService();
    this.vehicleTypeService = new VehicleTypeService();
    this.paymentDetailsService = new PaymentDetailsService();
    this.driverProfileService = new DriverProfileService();
  }

  // POST /api/v3/quick-rides/fare-estimate  (protected — user only)
  //
  // Prices one trip across every active vehicle type, and returns the band each suggestion may be
  // nudged within. The rider picks a type and a fare from this response; createRide recomputes and
  // re-checks the same band, so a hand-rolled offer never gets through.
  getFareEstimate = async (req, res) => {
    const { pickupCoordinates, dropCoordinates } = req.body;

    const errors = [];
    const pickup = validateCoordinates(pickupCoordinates, 'pickupCoordinates', errors);
    const drop = validateCoordinates(dropCoordinates, 'dropCoordinates', errors);

    if (errors.length) {
      return res.status(400).json({ message: 'Pickup and drop coordinates are required', errors });
    }

    try {
      const vehicleTypes = await this.vehicleTypeService.getAllVehicleTypes({ isActive: true });
      if (!vehicleTypes.length) {
        return res.status(404).json({ message: 'No vehicle types are available right now' });
      }

      const { distanceKm, durationMin } = await this.mapsService.getDistanceAndDuration(pickup, drop);

      if (distanceKm > env.MAX_RIDE_DISTANCE_KM) {
        return res.status(400).json({
          message: `QuickRide is available for trips up to ${env.MAX_RIDE_DISTANCE_KM} km. This trip is ${distanceKm} km.`,
        });
      }

      return res.status(200).json({
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        fareOptions: this.fareService.computeFareOptions(vehicleTypes, distanceKm, durationMin),
      });
    } catch (error) {
      console.log(error);
      if (error instanceof RouteNotFoundError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ error: 'Failed to estimate fare', message: 'Internal server error' });
    }
  };

  // POST /api/v3/quick-rides  (protected — user only)
  createRide = async (req, res) => {
    // Rider is taken from the auth token, never the request body
    const bookedBy = req.user._id;

    const { pickupLocationName, dropLocationName, pickupCoordinates, dropCoordinates, vehicleTypeId, offeredFare } =
      req.body;

    const errors = [];
    if (!pickupLocationName) errors.push({ field: 'pickupLocationName', message: 'Pickup location name is required' });
    if (!dropLocationName) errors.push({ field: 'dropLocationName', message: 'Drop location name is required' });
    if (!vehicleTypeId) errors.push({ field: 'vehicleTypeId', message: 'Vehicle type is required' });

    const pickup = validateCoordinates(pickupCoordinates, 'pickupCoordinates', errors);
    const drop = validateCoordinates(dropCoordinates, 'dropCoordinates', errors);

    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const existing = await this.quickRideService.getSearchingRideForUser(bookedBy);
      if (existing) {
        return res.status(409).json({
          message: 'You already have a ride searching for drivers. Cancel it before booking another.',
          rideId: existing._id,
        });
      }

      const vehicleType = await resolveVehicleType(vehicleTypeId);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }

      const { distanceKm, durationMin } = await this.mapsService.getDistanceAndDuration(pickup, drop);

      if (distanceKm > env.MAX_RIDE_DISTANCE_KM) {
        return res.status(400).json({
          message: `QuickRide is available for trips up to ${env.MAX_RIDE_DISTANCE_KM} km. This trip is ${distanceKm} km.`,
        });
      }

      const suggestedFare = this.fareService.computeSuggestedFare(vehicleType, distanceKm, durationMin);
      const offerBounds = this.fareService.getOfferBounds(suggestedFare);

      // The rider may move either side of the estimate, but only inside the band. The fare is
      // recomputed here rather than trusted from the estimate response, so the band is the real gate.
      const omitted = offeredFare === undefined || offeredFare === null || offeredFare === '';
      const requested = Number(offeredFare);

      if (!omitted && (!Number.isFinite(requested) || requested < offerBounds.min || requested > offerBounds.max)) {
        return res.status(400).json({
          message: `Your fare must be between ${offerBounds.min} and ${offerBounds.max} for this trip`,
          suggestedFare,
          offerBounds,
          errors: [
            {
              field: 'offeredFare',
              message: `offeredFare must be a number between ${offerBounds.min} and ${offerBounds.max}`,
            },
          ],
        });
      }

      const finalOffer = omitted ? suggestedFare : Math.round(requested);

      const ride = await this.quickRideService.createRide({
        pickupLocationName,
        dropLocationName,
        pickupCoordinates: toGeoPoint(pickup.latitude, pickup.longitude),
        dropCoordinates: toGeoPoint(drop.latitude, drop.longitude),
        vehicleTypeId: vehicleType._id,
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        suggestedFare,
        offeredFare: finalOffer,
        bookedBy,
        expiresAt: new Date(Date.now() + env.RIDE_PENDING_TTL_SECONDS * 1000),
      });

      // Fire-and-forget: the rider gets their ride back immediately and hears about drivers
      // over their socket
      this.rideDispatchService
        .dispatchRide(ride)
        .catch((error) => console.error('dispatchRide error:', error.message));

      return res.status(201).json({
        ride,
        offerBounds,
        bidBounds: this.fareService.getBidBounds(ride.offeredFare),
      });
    } catch (error) {
      console.log(error);
      if (error instanceof RouteNotFoundError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ error: 'Failed to create ride', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-rides/:id/fare  (protected — user only)
  // The rider raises their offer to attract drivers. Increase-only.
  updateFare = async (req, res) => {
    const offeredFare = Number(req.body.offeredFare);

    if (!Number.isFinite(offeredFare) || offeredFare <= 0) {
      return res.status(400).json({
        message: 'A valid fare is required',
        errors: [{ field: 'offeredFare', message: 'offeredFare must be a positive number' }],
      });
    }

    try {
      const ride = await this.quickRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      // Raising still has to land inside the band the suggestion set at booking time
      const offerBounds = this.fareService.getOfferBounds(ride.suggestedFare);
      if (offeredFare > offerBounds.max) {
        return res.status(400).json({
          message: `Fare cannot go above ${offerBounds.max} for this trip`,
          suggestedFare: ride.suggestedFare,
          offerBounds,
        });
      }

      const updated = await this.quickRideService.raiseOfferedFare(ride._id, req.user._id, offeredFare);

      // The conditional update also guards increase-only, so a null return needs disambiguating
      if (!updated) {
        if (ride.rideStatus !== 'searching' || ride.expiresAt <= new Date()) {
          return res.status(409).json({ message: 'This ride is no longer accepting bids' });
        }
        return res.status(400).json({
          message: `Fare can only be increased. Your current offer is ${ride.offeredFare}.`,
        });
      }

      // Re-dispatch reaches drivers who came online after the ride was created too
      this.rideDispatchService
        .dispatchRide(updated, { event: 'ride:fare_updated' })
        .catch((error) => console.error('dispatchRide error:', error.message));

      // Drivers already holding a bid need to know the ceiling moved
      const bids = await this.quickRideBidService.getActiveBidsForRide(updated._id);
      const bidBounds = this.fareService.getBidBounds(updated.offeredFare);
      bids.forEach((bid) =>
        emitToDriver(bid.requestedBy?._id ?? bid.requestedBy, 'ride:fare_updated', {
          rideId: String(updated._id),
          offeredFare: updated.offeredFare,
          bidBounds,
        })
      );

      return res.status(200).json({ message: 'Fare updated successfully.', ride: updated, offerBounds, bidBounds });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to update fare', message: 'Internal server error' });
    }
  };

  // Open rides a given driver could bid on right now, shaped for the ride cards.
  // Shared by /available and /live so the two can never drift apart. Returns null when the driver
  // has no vehicle, which each caller reports in its own way.
  findOpenRidesForDriver = async (driverId, latitude, longitude) => {
    const vehicle = await this.vehicleService.getVehicleByDriver(driverId);
    if (!vehicle) return null;

    const rides = await this.quickRideService.findOpenRidesNear({
      latitude,
      longitude,
      vehicleTypeId: vehicle.vehicleTypeId?._id ?? vehicle.vehicleTypeId,
      radiusKm: env.DRIVER_SEARCH_RADIUS_MAX_KM,
    });

    return rides.map((ride) => ({
      ...ride,
      startOtp: undefined,
      trackingToken: undefined,
      pickupCoordinates: fromGeoPoint(ride.pickupCoordinates),
      dropCoordinates: fromGeoPoint(ride.dropCoordinates),
      distanceFromDriverKm: Number((ride.distanceFromDriverMeters / 1000).toFixed(2)),
      bidBounds: this.fareService.getBidBounds(ride.offeredFare),
    }));
  };

  // GET /api/v3/quick-rides/available  (protected — driver only)
  // Polling fallback for a dropped socket.
  getAvailableRides = async (req, res) => {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        message: 'Your current location is required',
        errors: [{ field: 'latitude,longitude', message: 'Valid latitude and longitude query params are required' }],
      });
    }

    try {
      const driverId = req.user._id;

      // Same gate as dispatch and bidding — a busy driver sees nothing. The default context is
      // 'quickride', so this also covers a driver whose outstation pickup is now imminent, and
      // busyReason tells the app which of the two it was.
      const availability = await this.driverAvailabilityService.checkDriverAvailability(driverId);
      if (!availability.available) {
        return res.status(200).json({
          busy: true,
          busyReason: availability.reason,
          busyMessage: availability.message,
          count: 0,
          data: [],
        });
      }

      const data = await this.findOpenRidesForDriver(driverId, latitude, longitude);
      if (!data) {
        return res.status(409).json({ message: 'Register a vehicle before accepting rides' });
      }

      return res.status(200).json({ busy: false, count: data.length, data });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch rides', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-rides/live  (protected — either role)
  //
  // The single call an app makes when it opens or comes back from the background. It answers
  // "where was I?" in one round trip, for both sides, so neither app has to reconstruct its
  // screen from a ride list plus a bid list plus a status guess.
  getLiveRides = async (req, res) => {
    try {
      if (req.role === 'driver') return await this.getLiveForDriver(req, res);
      return await this.getLiveForUser(req, res);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to load live state', message: 'Internal server error' });
    }
  };

  // The rider's live view: their in-flight ride and the bids currently on it.
  getLiveForUser = async (req, res) => {
    const ride = await this.quickRideService.getLiveRideForUser(req.user._id);

    if (!ride) {
      return res.status(200).json({ role: 'user', hasLiveRide: false, ride: null, bids: [], count: 0 });
    }

    // Bids only exist while the ride is still out for them. Each carries the driver card, so a
    // rider resuming the app sees the same bid list they were looking at before it backgrounded.
    const bids =
      ride.rideStatus === 'searching'
        ? await this.driverProfileService.attachToBids(
            await this.quickRideBidService.getActiveBidsForRide(ride._id)
          )
        : [];

    return res.status(200).json({
      role: 'user',
      hasLiveRide: true,
      ride,
      rideStatus: ride.rideStatus,
      offerBounds: this.fareService.getOfferBounds(ride.suggestedFare),
      bidBounds: this.fareService.getBidBounds(ride.offeredFare),
      // Only ever populated once a driver is assigned — this is the rider's own view of their ride
      startOtp: ride.rideStatus === 'assigned' ? ride.startOtp : null,
      trackingUrl: buildTrackingUrl(ride.trackingToken),
      count: bids.length,
      bids,
    });
  };

  // The driver's live view: the ride they are committed to, or — if free — their pending bids and
  // the open rides around them. Location is optional so the call still works before GPS is ready.
  getLiveForDriver = async (req, res) => {
    const driverId = req.user._id;
    const ride = await this.quickRideService.getLiveRideForDriver(driverId);


    if (ride) {
      return res.status(200).json({
        role: 'driver',
        busy: true,
        hasLiveRide: true,
        ride,
        rideStatus: ride.rideStatus,
        // What the details screen should navigate to for this phase
        navigateTo: ride.rideStatus === 'assigned' ? 'pickup' : 'drop',
        bids: [],
        availableRides: [],
        count: 0,
      });
    }

    // No live QuickRide, but an outstation trip whose pickup is within the block window still
    // reserves this driver. Without this they would get busy:false and a list of cards that all
    // 409 on bid.
    const availability = await this.driverAvailabilityService.checkDriverAvailability(driverId);
    if (!availability.available) {
      return res.status(200).json({
        role: 'driver',
        busy: true,
        busyReason: availability.reason,
        busyMessage: availability.message,
        hasLiveRide: false,
        ride: null,
        bids: [],
        availableRides: [],
        count: 0,
      });
    }

    const bids = await this.quickRideBidService.getActiveBidsForDriver(driverId);

    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const hasLocation = isValidCoordinate(latitude, longitude);


    
  

    const availableRides = hasLocation ? await this.findOpenRidesForDriver(driverId, latitude, longitude) : [];


    return res.status(200).json({
      role: 'driver',
      busy: false,
      hasLiveRide: false,
      ride: null,
      // Distinguishes "no rides nearby" from "you did not tell me where you are"
      needsLocation: !hasLocation,
      needsVehicle: availableRides === null,
      count: bids.length,
      bids,
      availableRides: availableRides ?? [],
    });
  };

  // GET /api/v3/quick-rides/my  (protected)
  //
  // Ride history for whichever side is calling, newest first. All filters are optional and combine:
  //   ?status=completed,cancelled       one status or a list
  //   ?date=2026-07-30                  a single calendar day
  //   ?from=2026-07-01&to=2026-07-30    an inclusive range; either bound works on its own
  // Bare dates are calendar days in the app's zone (env.APP_UTC_OFFSET_MINUTES, IST by default);
  // send a full ISO timestamp when the client needs an exact instant. Filtering is on booking
  // time (createdAt), which is what a history list is ordered by.
  getMyRides = async (req, res) => {
    const errors = [];
    const statuses = parseRideStatuses(req.query.status, errors, RIDE_STATUSES);
    const createdAt = parseDateRange(req.query, errors);

    if (errors.length) {
      return res.status(400).json({ message: 'Invalid ride filters', errors });
    }

    try {
      const filters = { statuses, dateRange: createdAt };

      const rides =
        req.role === 'driver'
          ? await this.quickRideService.getRidesForDriver(req.user._id, filters)
          : await this.quickRideService.getRidesForUser(req.user._id, filters);

      return res.status(200).json({
        count: rides.length,
        // Echoed back so the app can label the list with the window it actually got
        filters: {
          status: statuses ?? [],
          from: createdAt?.$gte ?? null,
          to: createdAt?.$lte ?? null,
        },
        data: rides,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch rides', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-rides/track/:token
  // The token IS the credential. Deliberately redacted: no phone numbers, no OTP, no fare,
  // no rider identity — a shared link must not leak either party.
  trackRide = async (req, res) => {
    try {
      const ride = await this.quickRideService.getRideByTrackingToken(req.params.token);

      // An unknown token and an ended ride are intentionally indistinguishable
      if (!ride) return res.status(404).json({ message: 'This tracking link is no longer valid' });

      const lastLocation = ride.assignedTo
        ? await this.driverLocationService.getLastLocation(ride.assignedTo._id ?? ride.assignedTo)
        : null;

      const vehicle = ride.assignedTo
        ? await this.vehicleService.getVehicleByDriver(ride.assignedTo._id ?? ride.assignedTo)
        : null;

      return res.status(200).json({
        rideId: String(ride._id),
        rideStatus: ride.rideStatus,
        pickupLocationName: ride.pickupLocationName,
        dropLocationName: ride.dropLocationName,
        pickupCoordinates: fromGeoPoint(ride.pickupCoordinates),
        dropCoordinates: fromGeoPoint(ride.dropCoordinates),
        estimatedDistanceKm: ride.estimatedDistanceKm,
        estimatedDurationMin: ride.estimatedDurationMin,
        driver: ride.assignedTo
          ? { name: String(ride.assignedTo.name || '').split(' ')[0], profileImageUrl: ride.assignedTo.profileImageUrl }
          : null,
        vehicle: vehicle
          ? {
              vehicleName: vehicle.vehicleName,
              vehicleNumber: vehicle.vehicleNumber,
              vehicleType: vehicle.vehicleTypeId?.name,
            }
          : null,
        lastLocation,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to load tracking', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-rides/:id  (protected — participants only)
  getRideById = async (req, res) => {
    try {
      const ride = await this.quickRideService.getRideById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      const isRider = String(ride.bookedBy?._id ?? ride.bookedBy) === String(req.user._id);
      const isDriver = String(ride.assignedTo?._id ?? ride.assignedTo) === String(req.user._id);

      if (!isRider && !isDriver) {
        return res.status(403).json({ error: 'Forbidden: you are not part of this ride' });
      }

      // Only the rider ever sees the start OTP — the driver has to be told it out loud.
      if (isRider && ride.rideStatus === 'assigned') {
        const withOtp = await this.quickRideService.getRideWithOtp(ride._id);
        return res.status(200).json({
          ride: withOtp,
          trackingUrl: buildTrackingUrl(withOtp.trackingToken),
        });
      }

      return res.status(200).json({ ride });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch ride', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-rides/:id/bids  (protected — user only)
  getRideBids = async (req, res) => {
    try {
      const ride = await this.quickRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      const bids = await this.driverProfileService.attachToBids(
        await this.quickRideBidService.getActiveBidsForRide(ride._id)
      );
      return res.status(200).json({ count: bids.length, data: bids });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch bids', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-rides/:id/start  (protected — driver only)
  // The rider reads the OTP out; the driver types it in. Proof the rider is actually in the vehicle.
  startRide = async (req, res) => {
    const { startOtp } = req.body;

    if (!startOtp) {
      return res.status(400).json({
        message: 'Start OTP is required',
        errors: [{ field: 'startOtp', message: 'Ask the rider for their start OTP' }],
      });
    }

    try {
      const ride = await this.quickRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride is assigned to another driver' });
      }

      if (ride.rideStatus !== 'assigned') {
        return res.status(409).json({ message: `Ride cannot be started while it is ${ride.rideStatus}` });
      }

      if (ride.startOtpAttempts >= env.RIDE_START_OTP_MAX_ATTEMPTS) {
        return res.status(423).json({
          message: 'Too many incorrect OTP attempts. This ride is locked — please cancel and rebook.',
        });
      }

      const started = await this.quickRideService.startRide(ride._id, req.user._id, startOtp);

      if (!started) {
        const updated = await this.quickRideService.recordFailedStartOtp(ride._id);
        const remaining = Math.max(0, env.RIDE_START_OTP_MAX_ATTEMPTS - updated.startOtpAttempts);
        return res.status(400).json({ message: 'Incorrect OTP', attemptsRemaining: remaining });
      }

      const payload = { rideId: String(started._id), startedAt: started.startedAt };
      emitToUser(started.bookedBy?._id ?? started.bookedBy, 'ride:started', payload);
      emitToDriver(started.assignedTo?._id ?? started.assignedTo, 'ride:started', payload);

      // Rider only. The driver just typed the OTP in — they know the ride started.
      notifyUser(started.bookedBy?._id ?? started.bookedBy, 'ride:started', payload);

      return res.status(200).json({ message: 'Ride started successfully.', ride: started });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to start ride', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-rides/:id/complete  (protected — driver only)
  // Also what releases the driver from the busy gate.
  completeRide = async (req, res) => {
    try {
      const completed = await this.quickRideService.completeRide(req.params.id, req.user._id);

      if (!completed) {
        const ride = await this.quickRideService.getRideRaw(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (String(ride.assignedTo) !== String(req.user._id)) {
          return res.status(403).json({ error: 'Forbidden: this ride is assigned to another driver' });
        }
        return res.status(409).json({ message: `Only a ride in progress can be completed (it is ${ride.rideStatus})` });
      }

      const payload = {
        rideId: String(completed._id),
        completedAt: completed.completedAt,
        finalFare: completed.finalFare,
      };
      emitToUser(completed.bookedBy?._id ?? completed.bookedBy, 'ride:completed', payload);
      emitToDriver(completed.assignedTo?._id ?? completed.assignedTo, 'ride:completed', payload);

      // Rider only, for the same reason as ride:started — the driver tapped this button.
      notifyUser(completed.bookedBy?._id ?? completed.bookedBy, 'ride:completed', payload);

      await closeRideRoom(completed._id, 'completed');
      
      const paymentDetails = await this.paymentDetailsService.getByDriver(completed.assignedTo?._id ?? completed.assignedTo);

      return res.status(200).json({ message: 'Ride completed successfully.', ride: completed, paymentDetails });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to complete ride', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-rides/:id/cancel  (protected — either party)
  cancelRide = async (req, res) => {
    const { cancellationReason } = req.body;

    console.log(`User ${req.user._id} (${req.role}) is cancelling ride ${req.params.id} for reason: ${cancellationReason}`);

    try {
      const ride = await this.quickRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      const isRider = String(ride.bookedBy) === String(req.user._id);
      const isDriver = String(ride.assignedTo) === String(req.user._id);

      if (!isRider && !isDriver) {
        return res.status(403).json({ error: 'Forbidden: you are not part of this ride' });
      }

      // cancelledBy comes from the token's role, never the body
      const cancelled = await this.quickRideService.cancelRide(ride._id, {
        cancelledBy: req.role,
        cancellationReason,
      });

      if (!cancelled) {
        return res.status(409).json({ message: `A ride that is ${ride.rideStatus} cannot be cancelled` });
      }

      const doomed = await this.quickRideBidService.deleteOtherBidsForRide(cancelled._id, null);

      const payload = {
        rideId: String(cancelled._id),
        cancelledBy: cancelled.cancelledBy,
        cancellationReason: cancelled.cancellationReason,
      };

      doomed.forEach((bid) => emitToDriver(bid.requestedBy, 'ride:cancelled', payload));
      if (isRider && cancelled.assignedTo) emitToDriver(cancelled.assignedTo?._id ?? cancelled.assignedTo, 'ride:cancelled', payload);
      if (isDriver) emitToUser(cancelled.bookedBy?._id ?? cancelled.bookedBy, 'ride:cancelled', payload);

      // The push list is built as a SET, and without the person who did the cancelling.
      //
      // The socket emits above can safely overlap — the assigned driver is in `doomed` (their
      // accepted bid is deleted too) and named again on the isRider line, and clearing a card
      // twice is a no-op. Two identical banners on a lock screen are not. Nor is telling the
      // driver who just cancelled that "the rider cancelled", which is what a driver-side cancel
      // would otherwise do, since their own accepted bid is in `doomed`.
      const actorId = String(req.user._id);
      const cancelledDriverIds = new Set(
        [...doomed.map((bid) => bid.requestedBy), isRider ? cancelled.assignedTo : null]
          .map((id) => String(id?._id ?? id ?? ''))
          .filter((id) => id && id !== actorId)
      );

      cancelledDriverIds.forEach((driverId) => notifyDriver(driverId, 'ride:cancelled', payload));
      if (isDriver) notifyUser(cancelled.bookedBy?._id ?? cancelled.bookedBy, 'ride:cancelled', payload);

      // Everyone else the ride was ever pushed to. Bidders were just told above, and the assigned
      // driver either was too or is the one doing the cancelling — excluding both leaves exactly
      // the drivers with a card and no other reason to hear about this.
      await this.rideAudienceService.notifyAndDrain(cancelled._id, 'ride:cancelled', payload, {
        exclude: [...doomed.map((bid) => bid.requestedBy), cancelled.assignedTo],
      });

      await closeRideRoom(cancelled._id, 'cancelled');

      return res.status(200).json({ message: 'Ride cancelled successfully.', ride: cancelled });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to cancel ride', message: 'Internal server error' });
    }
  };
}
