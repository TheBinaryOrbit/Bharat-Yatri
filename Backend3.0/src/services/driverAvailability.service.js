import { env } from '../config/env.js';
import { QuickRide } from '../models/quickRide.model.js';
import { OutstationRide } from '../models/outstationRide.model.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_ACTIVE_RIDE_STATUSES } from '../constants/ride.constants.js';

// Whether a driver may be offered a new ride.
//
// Busy is DERIVED, never stored. There is no isBusy flag on the Driver model and no busy key in
// Redis, because a denormalized flag drifts the moment a process dies between assigning a ride and
// setting the flag — and both failure modes are bad (a driver invisible to dispatch forever, or one
// permanently double-booked). The rides collections are the single source of truth, so a driver
// frees up the instant their ride leaves an active status, with nothing to reset.
//
// What changed when outstation arrived: availability is no longer a single boolean about a driver.
// It is a question about a driver AND the kind of ride they are being considered for, because the
// two products block each other ASYMMETRICALLY:
//
//   considered for OUTSTATION → blocked by any active QuickRide, and by any active outstation ride
//   considered for QUICKRIDE  → blocked by any active QuickRide, and by an active outstation ride
//                               whose pickup is within OUTSTATION_QUICKRIDE_BLOCK_MINUTES
//
// The asymmetry is the whole point: a driver with a Delhi trip booked for Friday must keep earning
// on QuickRides all week, and must stop taking them two hours before they have to set off.
//
// Constraints stay batch-shaped on purpose: one query per constraint for the WHOLE driver list,
// never one query per driver, because the dispatch fan-out runs this inside the expanding-radius
// loop. New rules (duty status, cancel cooldown, rating floor, …) are one function plus one array
// entry, and every caller picks them up without changing.
export class DriverAvailabilityService {
  // No QuickRide currently in flight. Applies in BOTH directions.
  noActiveQuickRide = async (driverIds) => {
    const busy = await QuickRide.distinct('assignedTo', {
      assignedTo: { $in: driverIds },
      rideStatus: { $in: ACTIVE_RIDE_STATUSES },
    });

    const busySet = new Set(busy.map(String));
    return driverIds.filter((id) => !busySet.has(String(id)));
  };

  // One active outstation ride per driver, ever. A driver may hold pending BIDS on many outstation
  // rides — bids are free — but the moment one is accepted they are out of the market for the rest.
  noActiveOutstationRide = async (driverIds) => {
    const busy = await OutstationRide.distinct('assignedTo', {
      assignedTo: { $in: driverIds },
      rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES },
    });

    const busySet = new Set(busy.map(String));
    return driverIds.filter((id) => !busySet.has(String(id)));
  };

  // The one genuinely time-dependent rule. A driver holding an outstation ride keeps taking
  // QuickRides right up until they have to leave for it; from that moment they are reserved.
  //
  // `pickupAt <= now + BLOCK_MINUTES` also covers the arriving/in_progress cases for free: a trip
  // already under way has a pickupAt in the past, so it satisfies the predicate and keeps the
  // driver blocked until the ride reaches a terminal status and drops out of the active list.
  // Nothing has to be reset, and no timer has to fire.
  noImminentOutstationRide = async (driverIds) => {
    const blockUntil = new Date(Date.now() + env.OUTSTATION_QUICKRIDE_BLOCK_MINUTES * 60 * 1000);

    const busy = await OutstationRide.distinct('assignedTo', {
      assignedTo: { $in: driverIds },
      rideStatus: { $in: OUTSTATION_ACTIVE_RIDE_STATUSES },
      pickupAt: { $lte: blockUntil },
    });

    const busySet = new Set(busy.map(String));
    return driverIds.filter((id) => !busySet.has(String(id)));
  };

  // Ordered cheapest-and-most-selective first: most blocked drivers are blocked by a live
  // QuickRide, and any constraint that empties the list short-circuits the rest.
  constraintsByRideType = {
    quickride: [
      {
        reason: 'active_quick_ride',
        message: 'You already have an active ride. Finish it before bidding again.',
        filter: this.noActiveQuickRide,
      },
      {
        reason: 'outstation_pickup_imminent',
        message: 'Your outstation trip starts soon. QuickRides are paused until it is finished.',
        filter: this.noImminentOutstationRide,
      },
    ],
    outstation: [
      {
        reason: 'active_quick_ride',
        message: 'Finish your current ride before bidding on an outstation trip.',
        filter: this.noActiveQuickRide,
      },
      {
        reason: 'active_outstation_ride',
        message: 'You already have an outstation trip. Finish it before taking another.',
        filter: this.noActiveOutstationRide,
      },
    ],
  };

  // 'quickride' is the default so every pre-existing call site keeps working untouched — and picks
  // up the new outstation-block rule for free, which is precisely what we want.
  constraintsFor = (rideType) => this.constraintsByRideType[rideType] ?? this.constraintsByRideType.quickride;

  filterAvailableDrivers = async (driverIds, context = {}) => {
    let surviving = [...driverIds];

    for (const constraint of this.constraintsFor(context.rideType)) {
      if (!surviving.length) return [];
      surviving = await constraint.filter(surviving, context);
    }

    return surviving;
  };

  // Defined in terms of the batch check, so a new constraint is written once and both paths get it.
  isDriverAvailable = async (driverId, context = {}) => {
    const available = await this.filterAvailableDrivers([driverId], context);
    return available.length === 1;
  };

  // Single-driver only. isDriverAvailable answers yes/no; this answers WHICH rule said no, so a
  // 409 can tell "finish your current ride" apart from "your outstation trip starts soon".
  // Never used in the fan-out — it is one query per constraint for one driver.
  checkDriverAvailability = async (driverId, context = {}) => {
    for (const constraint of this.constraintsFor(context.rideType)) {
      const surviving = await constraint.filter([driverId], context);
      if (!surviving.length) {
        return { available: false, reason: constraint.reason, message: constraint.message };
      }
    }

    return { available: true, reason: null, message: null };
  };
}
