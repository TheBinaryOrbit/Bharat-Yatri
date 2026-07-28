// A driver holding a ride in any of these states is busy and must not be offered another.
// Later lifecycle phases (e.g. 'arrived') join this list and the availability gate picks them up for free.
export const ACTIVE_RIDE_STATUSES = ['assigned', 'in_progress'];

// Statuses a ride can still be cancelled from. An in_progress ride cannot be cancelled —
// the rider is already in the vehicle, so that is a completion or a support case.
export const CANCELLABLE_RIDE_STATUSES = ['searching', 'assigned'];

// Terminal states. Reaching any of these tears down the ride room and frees the driver.
export const TERMINAL_RIDE_STATUSES = ['completed', 'cancelled', 'expired'];

// Socket room names. Identity rooms let a user/driver be reached across devices and reconnects.
export const rideRoomName = (rideId) => `ride:${rideId}`;
export const driverRoomName = (driverId) => `driver:${driverId}`;
export const userRoomName = (userId) => `user:${userId}`;
