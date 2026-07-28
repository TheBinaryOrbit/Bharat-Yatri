import { maybeGetIO } from './io.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { ACTIVE_RIDE_STATUSES, rideRoomName, driverRoomName, userRoomName } from '../constants/ride.constants.js';

const quickRideService = new QuickRideService();

// Every active ride owns a room. All in-ride traffic goes driver → server → room;
// there is no direct driver-to-passenger socket path.
//
//                     Driver  (publishes only)
//                        |
//                Socket.IO server  (validates)
//                        |
//                 room ride:{rideId}
//         +--------------+--------------+
//         v              v              v
//    Passenger      Admin panel   Tracking link
//    (read-only)    (read-only)    (read-only)

// Tags the driver's local sockets with the ride they are on, so the location handler knows
// where to broadcast without a database round-trip on every 5s ping.
const tagActiveRide = async (io, room, rideId) => {
  const sockets = await io.in(room).fetchSockets();
  sockets.forEach((s) => {
    s.data.activeRideId = rideId;
  });
};

// Called when a bid is accepted. The SERVER puts both parties in the room rather than waiting
// for them to ask — a client-initiated join would leave a race where the driver's first
// location ping lands before the rider has joined.
export const openRideRoom = async (ride) => {
  const io = maybeGetIO();
  if (!io) return;

  const rideId = String(ride._id);
  const room = rideRoomName(rideId);
  const driverRoom = driverRoomName(ride.assignedTo?._id ?? ride.assignedTo);
  const riderRoom = userRoomName(ride.bookedBy?._id ?? ride.bookedBy);

  io.in(driverRoom).socketsJoin(room);
  io.in(riderRoom).socketsJoin(room);

  await tagActiveRide(io, driverRoom, rideId);
};

// Authorises a join. The client supplies only a rideId — identity always comes from the
// handshake, never from the payload.
export const joinRideRoom = async (socket, rideId) => {
  const ride = await quickRideService.getRideRaw(rideId);
  if (!ride) return { ok: false, message: 'Ride not found' };

  if (!ACTIVE_RIDE_STATUSES.includes(ride.rideStatus)) {
    return { ok: false, message: 'This ride is no longer active' };
  }

  const { role, id, trackingRideId } = socket.data;

  const allowed =
    (role === 'driver' && String(ride.assignedTo) === String(id)) ||
    (role === 'user' && String(ride.bookedBy) === String(id)) ||
    role === 'admin' ||
    (role === 'viewer' && String(trackingRideId) === String(ride._id));

  if (!allowed) return { ok: false, message: 'Not a participant in this ride' };

  socket.join(rideRoomName(ride._id));
  if (role === 'driver') socket.data.activeRideId = String(ride._id);

  return { ok: true, ride };
};

// Called on EVERY terminal transition — completed, cancelled and expired alike.
//
// This is security-relevant, not housekeeping: a socket left in an ended ride's room would keep
// receiving that driver's next trip's location.
export const closeRideRoom = async (rideId, reason) => {
  const io = maybeGetIO();
  if (!io) return;

  const room = rideRoomName(rideId);

  io.to(room).emit('ride:ended', { rideId: String(rideId), reason });

  const sockets = await io.in(room).fetchSockets();
  sockets.forEach((s) => {
    if (String(s.data.activeRideId) === String(rideId)) s.data.activeRideId = null;
  });

  io.in(room).socketsLeave(room);
};
