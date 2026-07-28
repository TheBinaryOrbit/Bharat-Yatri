import axios from 'axios';
import { env } from '../config/env.js';

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

// Thrown when Google cannot price the trip. Callers turn this into a 4xx rather than
// silently falling back to a straight-line estimate, which would under-price every ride.
export class RouteNotFoundError extends Error {
  constructor(message = 'Could not find a route between these locations') {
    super(message);
    this.name = 'RouteNotFoundError';
  }
}

export class MapsService {
  // Road distance and drive time between two { latitude, longitude } points.
  getDistanceAndDuration = async (pickup, drop) => {
    const { data } = await axios.get(DISTANCE_MATRIX_URL, {
      params: {
        origins: `${pickup.latitude},${pickup.longitude}`,
        destinations: `${drop.latitude},${drop.longitude}`,
        mode: 'driving',
        key: env.GOOGLE_MAPS_API_KEY,
      },
      timeout: 10_000,
    });

    if (data.status !== 'OK') {
      throw new RouteNotFoundError(data.error_message || `Distance Matrix returned ${data.status}`);
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new RouteNotFoundError(`No drivable route found (${element?.status || 'NO_RESULT'})`);
    }

    return {
      distanceKm: Number((element.distance.value / 1000).toFixed(2)),
      durationMin: Math.round(element.duration.value / 60),
    };
  };
}
