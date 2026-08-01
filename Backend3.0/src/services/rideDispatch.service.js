import { DriverLocationService } from './driverLocation.service.js';
import { DriverAvailabilityService } from './driverAvailability.service.js';
import { FareService } from './fare.service.js';
import { RideAudienceService } from './rideAudience.service.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';
import { fromGeoPoint } from '../utils/geo.js';

export class RideDispatchService {
  constructor() {
    this.driverLocationService = new DriverLocationService();
    this.driverAvailabilityService = new DriverAvailabilityService();
    this.fareService = new FareService();
    this.rideAudienceService = new RideAudienceService();
  }

  buildRequestPayload = (ride, distanceFromDriverKm) => {
    const bounds = this.fareService.getBidBounds(ride.offeredFare);

    return {
      rideId: String(ride._id),
      pickupLocationName: ride.pickupLocationName,
      dropLocationName: ride.dropLocationName,
      pickupCoordinates: fromGeoPoint(ride.pickupCoordinates),
      dropCoordinates: fromGeoPoint(ride.dropCoordinates),
      vehicleTypeId: String(ride.vehicleTypeId?._id ?? ride.vehicleTypeId),
      estimatedDistanceKm: ride.estimatedDistanceKm,
      estimatedDurationMin: ride.estimatedDurationMin,
      suggestedFare: ride.suggestedFare,
      offeredFare: ride.offeredFare,
      bidBounds: bounds,
      expiresAt: ride.expiresAt,
      distanceFromDriverKm,
    };
  };

  // The outstation card. Same core payload plus what only a scheduled trip has — and rideType,
  // which makes the payload self-describing in a log even though the event name already says it.
  buildOutstationRequestPayload = (ride, distanceFromDriverKm) => ({
    ...this.buildRequestPayload(ride, distanceFromDriverKm),
    rideType: 'outstation',
    bookingType: ride.bookingType,
    pickupAt: ride.pickupAt,
  });

  // Finds nearby, eligible drivers and pushes the ride to them.
  //
  // Reused verbatim for fare raises with event:'ride:fare_updated' — re-dispatching also reaches
  // drivers who came online after the ride was created, which is what raising the price is for.
  //
  // Every option defaults to the QuickRide behaviour, so both of its call sites are untouched:
  //   rideType   selects the availability constraint set
  //   buildPayload / event   shape and name the card the driver app receives
  //   radius     overrides the expanding ring (outstation uses one fixed sweep)
  //   audienceTtlSeconds     keeps the audience set alive as long as the ride itself
  dispatchRide = async (
    ride,
    {
      event = 'ride:request',
      rideType = 'quickride',
      buildPayload = this.buildRequestPayload,
      radius = null,
      audienceTtlSeconds = null,
      noDriversEvent = 'ride:no_drivers',
    } = {}
  ) => {
    const pickup = fromGeoPoint(ride.pickupCoordinates);
    if (!pickup) return { drivers: [], radiusKm: 0 };

    // The availability filter is injected so it runs INSIDE the expanding loop — a 2km ring full
    // of busy drivers must widen to 4km, not end the search with an empty result.
    const filter = async (found) => {
      const ids = found.map((d) => d.driverId);
      const available = new Set(
        (await this.driverAvailabilityService.filterAvailableDrivers(ids, { ride, rideType })).map(String)
      );
      return found.filter((d) => available.has(String(d.driverId)));
    };

    const { drivers, radiusKm } = await this.driverLocationService.findNearbyDriversExpanding({
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      vehicleTypeId: String(ride.vehicleTypeId?._id ?? ride.vehicleTypeId),
      filter,
      radius,
    });

    if (!drivers.length) {
      emitToUser(ride.bookedBy?._id ?? ride.bookedBy, noDriversEvent, {
        rideId: String(ride._id),
        searchedRadiusKm: radiusKm,
      });
      return { drivers: [], radiusKm };
    }

    // Recorded BEFORE the fan-out, not after. A ride cancelled mid-dispatch drains an audience that
    // does not yet contain these drivers, and they keep a card for a dead ride — the exact bug this
    // set exists to prevent. Remembering first inverts the race into the harmless direction: a
    // driver who is recorded but never reached gets a cancel event for a card they never had, and
    // removing a card that isn't on screen is a no-op in the app.
    await this.rideAudienceService.remember(
      ride._id,
      drivers.map((driver) => driver.driverId),
      { ttlSeconds: audienceTtlSeconds }
    );

    drivers.forEach((driver) => {
      emitToDriver(driver.driverId, event, buildPayload(ride, driver.distanceKm));
    });

    return { drivers, radiusKm };
  };
}
