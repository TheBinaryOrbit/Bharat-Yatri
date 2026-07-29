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

  // Finds nearby, eligible drivers and pushes the ride to them.
  //
  // Reused verbatim for fare raises with event:'ride:fare_updated' — re-dispatching also reaches
  // drivers who came online after the ride was created, which is what raising the price is for.
  dispatchRide = async (ride, { event = 'ride:request' } = {}) => {
    const pickup = fromGeoPoint(ride.pickupCoordinates);
    if (!pickup) return { drivers: [], radiusKm: 0 };

    // The availability filter is injected so it runs INSIDE the expanding loop — a 2km ring full
    // of busy drivers must widen to 4km, not end the search with an empty result.
    const filter = async (found) => {
      const ids = found.map((d) => d.driverId);
      const available = new Set(
        (await this.driverAvailabilityService.filterAvailableDrivers(ids, { ride })).map(String)
      );
      return found.filter((d) => available.has(String(d.driverId)));
    };

    const { drivers, radiusKm } = await this.driverLocationService.findNearbyDriversExpanding({
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      vehicleTypeId: String(ride.vehicleTypeId?._id ?? ride.vehicleTypeId),
      filter,
    });

    if (!drivers.length) {
      emitToUser(ride.bookedBy?._id ?? ride.bookedBy, 'ride:no_drivers', {
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
      drivers.map((driver) => driver.driverId)
    );

    drivers.forEach((driver) => {
      emitToDriver(driver.driverId, event, this.buildRequestPayload(ride, driver.distanceKm));
    });

    return { drivers, radiusKm };
  };
}
