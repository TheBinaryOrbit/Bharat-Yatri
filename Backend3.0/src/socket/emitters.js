import { maybeGetIO } from './io.js';
import { driverRoomName, userRoomName, rideRoomName } from '../constants/ride.constants.js';

// Services emit through these helpers and never touch `io` directly, so the transport stays
// swappable and every emit goes to an identity room rather than a remembered socket id.
const emitTo = (room, event, payload) => {
  const io = maybeGetIO();
  if (!io) return false;

  io.to(room).emit(event, payload);
  return true;
};

export const emitToDriver = (driverId, event, payload) =>
  emitTo(driverRoomName(driverId), event, payload);

export const emitToUser = (userId, event, payload) => emitTo(userRoomName(userId), event, payload);

export const emitToRide = (rideId, event, payload) => emitTo(rideRoomName(rideId), event, payload);
