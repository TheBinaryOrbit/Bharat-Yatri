import { env } from '../config/env.js';

export class FareService {
  // System estimate from the vehicle type's own rates.
  computeSuggestedFare = (vehicleType, distanceKm, durationMin) => {
    const { baseFare = 0, ratePerKm = 0, ratePerMinute = 0 } = vehicleType;
    return Math.round(baseFare + ratePerKm * distanceKm + ratePerMinute * durationMin);
  };

  // The band the rider's own offer must fall inside.
  //
  // Bounds track the SUGGESTED fare, so the rider can nudge the system estimate up or down
  // but cannot invent a fare — the app only ever offers them a value from this window.
  getOfferBounds = (suggestedFare) => ({
    min: Math.round(suggestedFare * env.OFFER_MIN_MULTIPLIER),
    max: Math.round(suggestedFare * env.OFFER_MAX_MULTIPLIER),
  });

  // One quote per vehicle type for the same trip — the fare-estimate screen renders this list,
  // and the rider picks a type plus a fare from within its band.
  computeFareOptions = (vehicleTypes, distanceKm, durationMin) =>
    vehicleTypes.map((vehicleType) => {
      const suggestedFare = this.computeSuggestedFare(vehicleType, distanceKm, durationMin);
      return {
        vehicleType,
        suggestedFare,
        offerBounds: this.getOfferBounds(suggestedFare),
      };
    });

  // The band a driver's bid must fall inside.
  //
  // Bounds track the rider's OFFERED fare, not the suggested one, so raising the offer raises
  // the ceiling drivers may bid to — which is the point of letting the rider raise it.
  getBidBounds = (offeredFare) => ({
    min: Math.round(offeredFare * env.BID_MIN_MULTIPLIER),
    max: Math.round(offeredFare * env.BID_MAX_MULTIPLIER),
  });
}
