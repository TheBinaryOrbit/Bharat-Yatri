import { QuickRide } from '../models/quickRide.model.js';
import { ACTIVE_RIDE_STATUSES } from '../constants/ride.constants.js';

// Whether a driver may be offered a new ride.
//
// Busy is DERIVED, never stored. There is no isBusy flag on the Driver model and no busy key in
// Redis, because a denormalized flag drifts the moment a process dies between assigning a ride and
// setting the flag — and both failure modes are bad (a driver invisible to dispatch forever, or one
// permanently double-booked). The rides collection is the single source of truth, so a driver frees
// up the instant their ride leaves an active status, with nothing to reset.
//
// Constraints are batch-shaped on purpose: no per-driver queries in the dispatch fan-out.
// New rules (max concurrent bids, duty status, cancel cooldown, rating floor, …) are added to
// the `constraints` array and every caller picks them up without changing.
export class DriverAvailabilityService {
  // Drivers with no ride currently in flight.
  noActiveRide = async (driverIds) => {
    const busy = await QuickRide.distinct('assignedTo', {
      assignedTo: { $in: driverIds },
      rideStatus: { $in: ACTIVE_RIDE_STATUSES },
    });

    const busySet = new Set(busy.map(String));
    return driverIds.filter((id) => !busySet.has(String(id)));
  };

  constraints = [this.noActiveRide];

  filterAvailableDrivers = async (driverIds, context = {}) => {
    let surviving = [...driverIds];

    for (const constraint of this.constraints) {
      if (!surviving.length) return [];
      surviving = await constraint(surviving, context);
    }

    return surviving;
  };

  // Defined in terms of the batch check, so a new constraint is written once and both paths get it.
  isDriverAvailable = async (driverId, context = {}) => {
    const available = await this.filterAvailableDrivers([driverId], context);
    return available.length === 1;
  };
}
