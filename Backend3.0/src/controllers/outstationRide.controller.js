import { env } from '../config/env.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { OutstationRideBidService } from '../services/outstationRideBid.service.js';
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
import { parsePickupAt } from '../utils/pickupTime.js';
import { validateCoordinates, parseRideStatuses } from '../utils/validate.js';
import { buildTrackingUrl } from '../utils/trackingUrl.js';
import { OUTSTATION_RIDE_STATUSES } from '../constants/ride.constants.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';
import { notifyDriver, notifyUser } from '../notifications/index.js';
import { openRideRoom, closeRideRoom } from '../socket/rideRoom.js';

// A single fixed sweep rather than the expanding rings QuickRide uses. Expressed in the ring
// machinery's own shape so there is no second code path: start = max = step means the loop body
// runs exactly once. See findNearbyDriversExpanding for why widening would be wrong here.
const OUTSTATION_RADIUS = {
  startKm: env.OUTSTATION_SEARCH_RADIUS_KM,
  maxKm: env.OUTSTATION_SEARCH_RADIUS_KM,
  stepKm: env.OUTSTATION_SEARCH_RADIUS_KM,
};

export class OutstationRideController {
  constructor() {
    this.outstationRideService = new OutstationRideService();
    this.outstationRideBidService = new OutstationRideBidService();
    this.driverAvailabilityService = new DriverAvailabilityService();
    this.driverLocationService = new DriverLocationService();
    this.rideDispatchService = new RideDispatchService();
    this.rideAudienceService = new RideAudienceService();
    this.driverProfileService = new DriverProfileService();
    this.fareService = new FareService();
    this.mapsService = new MapsService();
    this.vehicleService = new VehicleService();
    this.vehicleTypeService = new VehicleTypeService();
    this.paymentDetailsService = new PaymentDetailsService();
  }

  // The audience set has to outlive the ride it describes, or the cards it exists to pull back are
  // orphaned. QuickRide's default is its 5-minute ride plus a minute; an outstation auction runs
  // for up to 24 hours, so it passes its own remaining lifetime.
  audienceTtlFor = (ride) => Math.max(60, Math.ceil((new Date(ride.expiresAt) - Date.now()) / 1000) + 60);

  dispatchOptions = (ride, event) => ({
    event,
    rideType: 'outstation',
    buildPayload: this.rideDispatchService.buildOutstationRequestPayload,
    radius: OUTSTATION_RADIUS,
    audienceTtlSeconds: this.audienceTtlFor(ride),
    noDriversEvent: 'outstation:no_drivers',
  });

  // POST /api/v3/outstation-rides/fare-estimate  (protected — user only)
  //
  // Prices one trip across every active vehicle type, and returns the band each suggestion may be
  // nudged within. createRide recomputes and re-checks the same band, so a hand-rolled offer never
  // gets through.
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

      // The mirror image of QuickRide's cap, and inclusive on this side too, so a trip of exactly
      // OUTSTATION_MIN_DISTANCE_KM is bookable either way.
      if (distanceKm < env.OUTSTATION_MIN_DISTANCE_KM) {
        return res.status(400).json({
          message: `Outstation rides are for trips of at least ${env.OUTSTATION_MIN_DISTANCE_KM} km. This trip is ${distanceKm} km — book it as a QuickRide.`,
        });
      }

      return res.status(200).json({
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        fareOptions: this.fareService.computeFareOptions(vehicleTypes, distanceKm, durationMin),
        // So the app can bound its date picker without a second config call
        minPickupAt: new Date(Date.now() + env.OUTSTATION_MIN_LEAD_MINUTES * 60 * 1000),
        maxPickupAt: new Date(Date.now() + env.OUTSTATION_MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      console.log(error);
      if (error instanceof RouteNotFoundError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ error: 'Failed to estimate fare', message: 'Internal server error' });
    }
  };

  // POST /api/v3/outstation-rides  (protected — user only)
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
    const schedule = parsePickupAt(req.body, errors);

    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      // NOTE: there is deliberately no "you already have a ride searching" 409 here, and this is
      // the one place create diverges from QuickRide's. A QuickRide rider is hailing: two open
      // hails is almost always a double-tap, and the 409 protects them from it. An outstation
      // rider is PLANNING — next Friday's Delhi trip and next month's Jaipur trip are two
      // different intentions that must be able to sit out for bids at the same time. Rider-side
      // the two products are fully independent too: a live QuickRide has no bearing on booking an
      // outstation trip, and vice versa.

      const vehicleType = await resolveVehicleType(vehicleTypeId);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }

      const { distanceKm, durationMin } = await this.mapsService.getDistanceAndDuration(pickup, drop);

      if (distanceKm < env.OUTSTATION_MIN_DISTANCE_KM) {
        return res.status(400).json({
          message: `Outstation rides are for trips of at least ${env.OUTSTATION_MIN_DISTANCE_KM} km. This trip is ${distanceKm} km — book it as a QuickRide.`,
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

      // The pickup cap only means something for a SCHEDULED trip. For 'now', pickupAt is the
      // moment the ride was created, so min(now + 24h, now) would make the ride BORN EXPIRED and
      // the sweeper would kill it on the next tick, before any driver could bid. 'later' is
      // guaranteed non-degenerate by the minimum-lead-time check inside parsePickupAt.
      const ttlExpiry = Date.now() + env.OUTSTATION_RIDE_TTL_HOURS * 60 * 60 * 1000;
      const expiresAt = new Date(
        schedule.bookingType === 'later'
          ? Math.min(ttlExpiry, schedule.pickupAt.getTime())
          : ttlExpiry
      );

      const ride = await this.outstationRideService.createRide({
        pickupLocationName,
        dropLocationName,
        pickupCoordinates: toGeoPoint(pickup.latitude, pickup.longitude),
        dropCoordinates: toGeoPoint(drop.latitude, drop.longitude),
        vehicleTypeId: vehicleType._id,
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        suggestedFare,
        offeredFare: finalOffer,
        bookingType: schedule.bookingType,
        pickupAt: schedule.pickupAt,
        bookedBy,
        expiresAt,
      });

      // Fire-and-forget: the rider gets their ride back immediately and hears about drivers over
      // their socket. Push reaches whoever is online now; the /available browse list is what
      // catches drivers who were offline when a next-Friday trip was booked.
      this.rideDispatchService
        .dispatchRide(ride, this.dispatchOptions(ride, 'outstation:request'))
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

  // PATCH /api/v3/outstation-rides/:id/fare  (protected — user only)
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
      const ride = await this.outstationRideService.getRideRaw(req.params.id);
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

      const updated = await this.outstationRideService.raiseOfferedFare(ride._id, req.user._id, offeredFare);

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
        .dispatchRide(updated, this.dispatchOptions(updated, 'outstation:fare_updated'))
        .catch((error) => console.error('dispatchRide error:', error.message));

      // Drivers already holding a bid need to know the ceiling moved
      const bids = await this.outstationRideBidService.getActiveBidsForRide(updated._id);
      const bidBounds = this.fareService.getBidBounds(updated.offeredFare);
      bids.forEach((bid) =>
        emitToDriver(bid.requestedBy?._id ?? bid.requestedBy, 'outstation:fare_updated', {
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
  findOpenRidesForDriver = async (driverId, latitude, longitude, bookingType) => {
    const vehicle = await this.vehicleService.getVehicleByDriver(driverId);
    if (!vehicle) return null;

    const rides = await this.outstationRideService.findOpenRidesNear({
      latitude,
      longitude,
      vehicleTypeId: vehicle.vehicleTypeId?._id ?? vehicle.vehicleTypeId,
      radiusKm: env.OUTSTATION_SEARCH_RADIUS_KM,
      bookingType,
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

  // GET /api/v3/outstation-rides/available  (protected — driver only)
  //
  // Not just a polling fallback like QuickRide's. A trip booked for next Friday will never reach a
  // driver who is offline today, so this browse list is a first-class way of finding outstation
  // work — hence the wider radius and the optional bookingType filter.
  getAvailableRides = async (req, res) => {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const { bookingType } = req.query;

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        message: 'Your current location is required',
        errors: [{ field: 'latitude,longitude', message: 'Valid latitude and longitude query params are required' }],
      });
    }

    try {
      const driverId = req.user._id;

      // Same gate as dispatch and bidding — a driver who could not take the ride sees nothing,
      // and busyReason tells the app which of the rules stopped them.
      const availability = await this.driverAvailabilityService.checkDriverAvailability(driverId, {
        rideType: 'outstation',
      });

      if (!availability.available) {
        return res.status(200).json({
          busy: true,
          busyReason: availability.reason,
          busyMessage: availability.message,
          count: 0,
          data: [],
        });
      }

      const data = await this.findOpenRidesForDriver(driverId, latitude, longitude, bookingType);
      if (!data) {
        return res.status(409).json({ message: 'Register a vehicle before accepting rides' });
      }

      return res.status(200).json({ busy: false, busyReason: null, count: data.length, data });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch rides', message: 'Internal server error' });
    }
  };

  // GET /api/v3/outstation-rides/live  (protected — either role)
  //
  // The single call an app makes when it opens or comes back from the background.
  getLiveRides = async (req, res) => {
    try {
      if (req.role === 'driver') return await this.getLiveForDriver(req, res);
      return await this.getLiveForUser(req, res);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to load live state', message: 'Internal server error' });
    }
  };

  // The rider's live view. PLURAL, unlike QuickRide's: a planner can have several trips out for
  // bids at once, so this returns a list rather than one ride plus one bid array.
  getLiveForUser = async (req, res) => {
    const rides = await this.outstationRideService.getLiveRidesForUser(req.user._id);

    if (!rides.length) {
      return res.status(200).json({ role: 'user', hasLiveRides: false, count: 0, rides: [] });
    }

    // Bids for every searching ride in ONE query, then grouped here. A per-ride query in this loop
    // would be an N+1 that grows with how many trips the rider is planning.
    const searchingIds = rides.filter((ride) => ride.rideStatus === 'searching').map((ride) => ride._id);

    // Decorated flat, before grouping, for the same reason the bids are fetched flat: one ratings
    // lookup covers every bidding driver across every trip the rider has out.
    const allBids = await this.driverProfileService.attachToBids(
      await this.outstationRideBidService.getActiveBidsForRides(searchingIds)
    );

    const bidsByRide = new Map();
    allBids.forEach((bid) => {
      const key = String(bid.outstationRideId?._id ?? bid.outstationRideId);
      bidsByRide.set(key, [...(bidsByRide.get(key) || []), bid]);
    });

    return res.status(200).json({
      role: 'user',
      hasLiveRides: true,
      count: rides.length,
      rides: rides.map((ride) => {
        const bids = bidsByRide.get(String(ride._id)) || [];

        return {
          ride,
          rideStatus: ride.rideStatus,
          offerBounds: this.fareService.getOfferBounds(ride.suggestedFare),
          bidBounds: this.fareService.getBidBounds(ride.offeredFare),
          // The driver needs the OTP once they are committed; the rider reads it out at pickup.
          startOtp: ride.rideStatus === 'assigned' || ride.rideStatus === 'arriving' ? ride.startOtp : null,
          // Only ever non-null while 'arriving' — the token is minted when the driver sets off and
          // nulled the instant the rider is aboard.
          trackingUrl: buildTrackingUrl(ride.trackingToken),
          bidCount: bids.length,
          bids,
        };
      }),
    });
  };

  // The driver's live view: the trip they are committed to, or — if free — their pending bids and
  // the open trips around them. Location is optional so the call still works before GPS is ready.
  getLiveForDriver = async (req, res) => {
    const driverId = req.user._id;
    const ride = await this.outstationRideService.getLiveRideForDriver(driverId);

    if (ride) {
      return res.status(200).json({
        role: 'driver',
        busy: true,
        busyReason: 'active_outstation_ride',
        hasLiveRide: true,
        ride,
        rideStatus: ride.rideStatus,
        // What the details screen should navigate to for this phase. 'assigned' and 'arriving' are
        // both the approach; only once the rider is aboard does the destination change.
        navigateTo: ride.rideStatus === 'in_progress' ? 'drop' : 'pickup',
        trackingUrl: null, // the driver never gets the share link — it is the rider's to hand out
        bids: [],
        availableRides: [],
        count: 0,
      });
    }

    // Free of outstation work, but a live QuickRide still blocks them from taking a trip.
    const availability = await this.driverAvailabilityService.checkDriverAvailability(driverId, {
      rideType: 'outstation',
    });

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

    const bids = await this.outstationRideBidService.getActiveBidsForDriver(driverId);

    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const hasLocation = isValidCoordinate(latitude, longitude);

    const availableRides = hasLocation ? await this.findOpenRidesForDriver(driverId, latitude, longitude) : [];

    return res.status(200).json({
      role: 'driver',
      busy: false,
      busyReason: null,
      hasLiveRide: false,
      ride: null,
      // Distinguishes "no trips nearby" from "you did not tell me where you are"
      needsLocation: !hasLocation,
      needsVehicle: availableRides === null,
      count: bids.length,
      bids,
      availableRides: availableRides ?? [],
    });
  };

  // GET /api/v3/outstation-rides/my  (protected)
  //
  // Ride history for whichever side is calling. All filters are optional and combine:
  //   ?status=completed,cancelled       one status or a list
  //   ?date=2026-08-05                  a single calendar day
  //   ?from=2026-08-01&to=2026-08-30    an inclusive range; either bound works on its own
  //   ?by=pickupAt                      filter and sort on the DEPARTURE instead of the booking
  //
  // `by` is the one thing QuickRide's history does not have, and it is what a scheduled product
  // needs: a trip booked last month for next Friday belongs in next Friday's list, not last
  // month's. Both fields are indexed, so either choice is a seek.
  getMyRides = async (req, res) => {
    const errors = [];
    const statuses = parseRideStatuses(req.query.status, errors, OUTSTATION_RIDE_STATUSES);
    const dateRange = parseDateRange(req.query, errors);

    const by = req.query.by ?? 'createdAt';
    if (!['createdAt', 'pickupAt'].includes(by)) {
      errors.push({ field: 'by', message: 'by must be createdAt or pickupAt' });
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Invalid ride filters', errors });
    }

    try {
      const filters = { statuses, dateRange };

      const rides =
        req.role === 'driver'
          ? await this.outstationRideService.getRidesForDriver(req.user._id, filters, by)
          : await this.outstationRideService.getRidesForUser(req.user._id, filters, by);

      return res.status(200).json({
        count: rides.length,
        // Echoed back so the app can label the list with the window it actually got
        filters: {
          status: statuses ?? [],
          by,
          from: dateRange?.$gte ?? null,
          to: dateRange?.$lte ?? null,
        },
        data: rides,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch rides', message: 'Internal server error' });
    }
  };

  // GET /api/v3/outstation-rides/track/:token
  //
  // The token IS the credential. Deliberately redacted: no phone numbers, no OTP, no fare, no
  // rider identity — a shared link must not leak either party. Resolves only while the ride is
  // 'arriving', so the link covers the approach and stops working the moment the rider is aboard.
  trackRide = async (req, res) => {
    try {
      const ride = await this.outstationRideService.getRideByTrackingToken(req.params.token);

      // An unknown token, a started trip and an ended ride are intentionally indistinguishable
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
        bookingType: ride.bookingType,
        pickupAt: ride.pickupAt,
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

  // GET /api/v3/outstation-rides/:id  (protected — participants only)
  getRideById = async (req, res) => {
    try {
      const ride = await this.outstationRideService.getRideById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      const isRider = String(ride.bookedBy?._id ?? ride.bookedBy) === String(req.user._id);
      const isDriver = String(ride.assignedTo?._id ?? ride.assignedTo) === String(req.user._id);

      if (!isRider && !isDriver) {
        return res.status(403).json({ error: 'Forbidden: you are not part of this ride' });
      }

      // Only the rider ever sees the start OTP — the driver has to be told it out loud.
      if (isRider && (ride.rideStatus === 'assigned' || ride.rideStatus === 'arriving')) {
        const withOtp = await this.outstationRideService.getRideWithOtp(ride._id);
        return res.status(200).json({
          ride: withOtp,
          // null until the driver sets off; there is nothing to watch before that
          trackingUrl: buildTrackingUrl(withOtp.trackingToken),
        });
      }

      return res.status(200).json({ ride });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch ride', message: 'Internal server error' });
    }
  };

  // GET /api/v3/outstation-rides/:id/bids  (protected — user only)
  getRideBids = async (req, res) => {
    try {
      const ride = await this.outstationRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.bookedBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride belongs to another user' });
      }

      const bids = await this.driverProfileService.attachToBids(
        await this.outstationRideBidService.getActiveBidsForRide(ride._id)
      );
      return res.status(200).json({ count: bids.length, data: bids });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch bids', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/outstation-rides/:id/start  (protected — driver only)
  //
  // "I'm setting off." No OTP — the rider is not here yet. This is the step QuickRide does not
  // have, and it exists to make the tracking window narrow: a trip accepted three days ago streams
  // nothing until the driver actually departs, and the driver's own tap is the trigger, so no
  // scheduler is involved.
  startRide = async (req, res) => {
    try {
      const ride = await this.outstationRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride is assigned to another driver' });
      }

      const started = await this.outstationRideService.startRide(ride._id, req.user._id);
      if (!started) {
        return res.status(409).json({ message: `Ride cannot be started while it is ${ride.rideStatus}` });
      }

      // The server puts both parties in the room rather than waiting for them to ask — a
      // client-initiated join would race the driver's first location ping.
      await openRideRoom(started);

      // Two payloads: only the rider's carries the share link.
      emitToUser(started.bookedBy?._id ?? started.bookedBy, 'outstation:started', {
        rideId: String(started._id),
        arrivingAt: started.arrivingAt,
        trackingUrl: buildTrackingUrl(started.trackingToken),
      });
      emitToDriver(started.assignedTo?._id ?? started.assignedTo, 'outstation:started', {
        rideId: String(started._id),
        arrivingAt: started.arrivingAt,
      });

      // Rider only — and this is the most valuable push in the outstation flow. A trip booked days
      // ago goes quiet until this moment; "your driver is on the way" is the first thing the rider
      // has heard since they picked a bid, and their app is certainly closed.
      // The share link is left out on purpose: it is a credential, and a lock screen is not a
      // place to put one. The socket payload and GET /outstation-rides/:id still carry it.
      notifyUser(started.bookedBy?._id ?? started.bookedBy, 'outstation:started', {
        rideId: String(started._id),
        arrivingAt: started.arrivingAt,
      });

      return res.status(200).json({
        message: 'On your way. The rider can now track you.',
        ride: started,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to start ride', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/outstation-rides/:id/pickup  (protected — driver only)
  //
  // The rider reads the OTP out; the driver types it in. Proof the rider is actually in the
  // vehicle — and the moment the tracking window shuts.
  pickupRide = async (req, res) => {
    const { startOtp } = req.body;

    if (!startOtp) {
      return res.status(400).json({
        message: 'Start OTP is required',
        errors: [{ field: 'startOtp', message: 'Ask the rider for their start OTP' }],
      });
    }

    try {
      const ride = await this.outstationRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      if (String(ride.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Forbidden: this ride is assigned to another driver' });
      }

      if (ride.rideStatus !== 'arriving') {
        return res.status(409).json({
          message:
            ride.rideStatus === 'assigned'
              ? 'Start the ride before confirming the pickup'
              : `Pickup cannot be confirmed while the ride is ${ride.rideStatus}`,
        });
      }

      if (ride.startOtpAttempts >= env.RIDE_START_OTP_MAX_ATTEMPTS) {
        return res.status(423).json({
          message: 'Too many incorrect OTP attempts. This ride is locked — please cancel and rebook.',
        });
      }

      const pickedUp = await this.outstationRideService.pickupRide(ride._id, req.user._id, startOtp);

      if (!pickedUp) {
        const updated = await this.outstationRideService.recordFailedStartOtp(ride._id);
        const remaining = Math.max(0, env.RIDE_START_OTP_MAX_ATTEMPTS - updated.startOtpAttempts);
        return res.status(400).json({ message: 'Incorrect OTP', attemptsRemaining: remaining });
      }

      const payload = { rideId: String(pickedUp._id), startedAt: pickedUp.startedAt };
      emitToUser(pickedUp.bookedBy?._id ?? pickedUp.bookedBy, 'outstation:picked_up', payload);
      emitToDriver(pickedUp.assignedTo?._id ?? pickedUp.assignedTo, 'outstation:picked_up', payload);

      // Rider only. The driver just typed the OTP in.
      notifyUser(pickedUp.bookedBy?._id ?? pickedUp.bookedBy, 'outstation:picked_up', payload);

      // The approach leg is over, so the tracking window closes with it. The service already
      // nulled the token inside the atomic update; this tears down the room, which does three
      // things at once — it tells any share-link viewer the trip has started, evicts them, and
      // clears this ride from the driver's activeRideIds so their 5s pings stop feeding a room
      // nobody should be in. Emitted to the identity rooms first: those are unaffected by the
      // teardown, but reading them in this order is the only way the sequence is obvious.
      await closeRideRoom(pickedUp._id, 'picked_up');

      return res.status(200).json({ message: 'Pickup confirmed. Ride started.', ride: pickedUp });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to confirm pickup', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/outstation-rides/:id/complete  (protected — driver only)
  // Also what releases the driver's single outstation slot and reopens QuickRide dispatch.
  completeRide = async (req, res) => {
    try {
      const completed = await this.outstationRideService.completeRide(req.params.id, req.user._id);

      if (!completed) {
        const ride = await this.outstationRideService.getRideRaw(req.params.id);
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
      emitToUser(completed.bookedBy?._id ?? completed.bookedBy, 'outstation:completed', payload);
      emitToDriver(completed.assignedTo?._id ?? completed.assignedTo, 'outstation:completed', payload);

      // Rider only, for the same reason — the driver tapped this button.
      notifyUser(completed.bookedBy?._id ?? completed.bookedBy, 'outstation:completed', payload);

      // Already torn down at pickup — kept so a future status change cannot leave a room open.
      await closeRideRoom(completed._id, 'completed');

      const paymentDetails = await this.paymentDetailsService.getByDriver(
        completed.assignedTo?._id ?? completed.assignedTo
      );

      return res.status(200).json({ message: 'Ride completed successfully.', ride: completed, paymentDetails });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to complete ride', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/outstation-rides/:id/cancel  (protected — either party)
  cancelRide = async (req, res) => {
    const { cancellationReason } = req.body;

    try {
      const ride = await this.outstationRideService.getRideRaw(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      const isRider = String(ride.bookedBy) === String(req.user._id);
      const isDriver = String(ride.assignedTo) === String(req.user._id);

      if (!isRider && !isDriver) {
        return res.status(403).json({ error: 'Forbidden: you are not part of this ride' });
      }

      // cancelledBy comes from the token's role, never the body
      const cancelled = await this.outstationRideService.cancelRide(ride._id, {
        cancelledBy: req.role,
        cancellationReason,
      });

      if (!cancelled) {
        return res.status(409).json({ message: `A ride that is ${ride.rideStatus} cannot be cancelled` });
      }

      const doomed = await this.outstationRideBidService.deleteOtherBidsForRide(cancelled._id, null);

      const payload = {
        rideId: String(cancelled._id),
        cancelledBy: cancelled.cancelledBy,
        cancellationReason: cancelled.cancellationReason,
      };

      doomed.forEach((bid) => emitToDriver(bid.requestedBy, 'outstation:ride_cancelled', payload));
      if (isRider && cancelled.assignedTo) {
        emitToDriver(cancelled.assignedTo?._id ?? cancelled.assignedTo, 'outstation:ride_cancelled', payload);
      }
      if (isDriver) emitToUser(cancelled.bookedBy?._id ?? cancelled.bookedBy, 'outstation:ride_cancelled', payload);

      // A SET, minus whoever did the cancelling — see the identical block in
      // quickRide.controller.js for why the socket emits above may overlap and these must not.
      const actorId = String(req.user._id);
      const cancelledDriverIds = new Set(
        [...doomed.map((bid) => bid.requestedBy), isRider ? cancelled.assignedTo : null]
          .map((id) => String(id?._id ?? id ?? ''))
          .filter((id) => id && id !== actorId)
      );

      cancelledDriverIds.forEach((driverId) => notifyDriver(driverId, 'outstation:ride_cancelled', payload));
      if (isDriver) notifyUser(cancelled.bookedBy?._id ?? cancelled.bookedBy, 'outstation:ride_cancelled', payload);

      // Everyone else the ride was ever pushed to. Bidders were just told above, and the assigned
      // driver either was too or is the one doing the cancelling — excluding both leaves exactly
      // the drivers with a card and no other reason to hear about this.
      await this.rideAudienceService.notifyAndDrain(cancelled._id, 'outstation:ride_cancelled', payload, {
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
