// A driver holding a ride in any of these states is busy and must not be offered another.
// Later lifecycle phases (e.g. 'arrived') join this list and the availability gate picks them up for free.
export const ACTIVE_RIDE_STATUSES = ['assigned', 'in_progress'];

// Statuses a ride can still be cancelled from. An in_progress ride cannot be cancelled —
// the rider is already in the vehicle, so that is a completion or a support case.
export const CANCELLABLE_RIDE_STATUSES = ['searching', 'assigned'];

// Terminal states. Reaching any of these tears down the ride room and frees the driver.
export const TERMINAL_RIDE_STATUSES = ['completed', 'cancelled', 'expired'];

// Every status a ride can hold. This IS the model's rideStatus enum, and the list a history
// filter is validated against, so the two can never drift.
export const RIDE_STATUSES = ['searching', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'];

// The two booking flows. Passed as context to the shared availability, dispatch and socket layers,
// which behave differently depending on which kind of ride a driver is being considered for.
export const RIDE_TYPES = ['quickride', 'outstation'];

// Outstation only. 'now' is a hail; 'later' carries a real future pickupAt.
export const BOOKING_TYPES = ['now', 'later'];

// Outstation runs a longer lifecycle than QuickRide: 'arriving' is the leg between the driver
// setting off and the rider getting in, which QuickRide has no equivalent of.
//
// Deliberately kept OUT of RIDE_STATUSES above — that list is QuickRide's schema enum, and adding
// 'arriving' to it would make QuickRide accept a status it has no transition into or out of.
export const OUTSTATION_RIDE_STATUSES = [
  'searching',
  'assigned',
  'arriving',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
];

// A driver holding an outstation ride in any of these is committed to it.
export const OUTSTATION_ACTIVE_RIDE_STATUSES = ['assigned', 'arriving', 'in_progress'];

// An outstation ride is still cancellable while the driver is on their way; once the rider is in
// the vehicle (in_progress) it is a completion or a support case, exactly as with QuickRide.
export const OUTSTATION_CANCELLABLE_RIDE_STATUSES = ['searching', 'assigned', 'arriving'];

// The statuses with a room. Used by the socket join guard, the reconnect rejoin and the
// tracking-token lookups, so the tracking window is defined in a single place rather than restated
// at each gate — widen it here and every gate widens with it.
//
// The window opens when the driver taps start, NOT at assignment: an outstation trip can sit
// assigned for days, and a link that resolves for three days while the driver goes about other
// work is exactly what a departure-triggered window prevents. It then runs unbroken through the
// journey to a terminal status, which is why 'in_progress' is here and why the token survives
// pickup — the long leg is the one a rider actually wants their family watching.
//
// 'assigned' must never join this list: there is no token minted in that status, so a room would
// have no way to be shared and the driver is not yet committed to moving.
export const OUTSTATION_TRACKABLE_RIDE_STATUSES = ['arriving', 'in_progress'];

// Socket room names. Identity rooms let a user/driver be reached across devices and reconnects.
export const rideRoomName = (rideId) => `ride:${rideId}`;
export const driverRoomName = (driverId) => `driver:${driverId}`;
export const userRoomName = (userId) => `user:${userId}`;
