import { QuickRideService } from '../services/quickRide.service.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { ACTIVE_RIDE_STATUSES, OUTSTATION_TRACKABLE_RIDE_STATUSES } from '../constants/ride.constants.js';

const quickRideService = new QuickRideService();
const outstationRideService = new OutstationRideService();

// The statuses in which a ride room may be joined, PER RIDE TYPE.
//
// Both products track the trip itself; they differ only at the front. A QuickRide room opens the
// moment a bid is accepted, because the driver is minutes away and the rider is watching them
// approach. An outstation room cannot: a trip may be accepted days ahead, so it opens when the
// driver taps start and 'assigned' is deliberately absent below. From set-off both lists run the
// same way — through pickup and the journey, to a terminal status.
const JOINABLE_STATUSES = {
  quickride: ACTIVE_RIDE_STATUSES,
  outstation: OUTSTATION_TRACKABLE_RIDE_STATUSES,
};

const serviceFor = (rideType) => (rideType === 'outstation' ? outstationRideService : quickRideService);

// Normalises whatever the client sent. Anything unrecognised — including nothing at all — is
// 'quickride', so every already-shipped app keeps working unchanged.
export const normaliseRideType = (rideType) => (rideType === 'outstation' ? 'outstation' : 'quickride');

// Looks a ride up in the right collection and says whether its room is joinable right now.
//
// The type comes from the caller rather than being discovered by querying both collections: the
// authorisation rule itself differs by type (see JOINABLE_STATUSES), so a try-both resolver would
// still have to remember which collection produced the hit in order to pick the right status set.
// The ride type is load-bearing data here, not an incidental lookup detail.
export const resolveRideForRoom = async (rideId, rideType) => {
  const type = normaliseRideType(rideType);
  const ride = await serviceFor(type).getRideRaw(rideId);

  if (!ride) return { ride: null, rideType: type, joinable: false };

  return { ride, rideType: type, joinable: JOINABLE_STATUSES[type].includes(ride.rideStatus) };
};
