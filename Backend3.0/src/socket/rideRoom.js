import { maybeGetIO } from './io.js';
import { resolveRideForRoom } from './rideResolver.js';
import { rideRoomName, driverRoomName, userRoomName } from '../constants/ride.constants.js';

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
//
// The room itself is ride-type agnostic on purpose: the events inside it (ride:location,
// ride:ended) only ever reach sockets already in the room and carry a rideId, so nothing in this
// file needs to branch on ride type. That is the single biggest simplification in the socket
// layer, and the reason the outstation controllers reuse open/close verbatim.

// A driver may be in more than one ride room at a time — an outstation trip they are driving to
// and a QuickRide accepted before the outstation block window closed. So this is a SET of ids,
// not one, and the location handler fans out to all of them.
const addActiveRide = (socketLike, rideId) => {
  const current = socketLike.data.activeRideIds || [];
  if (!current.includes(rideId)) socketLike.data.activeRideIds = [...current, rideId];
};

// Tags the driver's local sockets with the rides they are on, so the location handler knows where
// to broadcast without a database round-trip on every 5s ping.
const tagActiveRide = async (io, room, rideId) => {
  const sockets = await io.in(room).fetchSockets();
  sockets.forEach((s) => addActiveRide(s, rideId));
};

// Called when the tracking window opens — on bid accept for QuickRide, on the driver setting off
// for outstation. The SERVER puts both parties in the room rather than waiting for them to ask: a
// client-initiated join would leave a race where the driver's first location ping lands before the
// rider has joined.
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

// Authorises a join. The client supplies a rideId and a rideType; identity always comes from the
// handshake, never from the payload — and a viewer's type comes from their tracking token, so a
// share-link holder cannot change which collection they are authorised against.
export const joinRideRoom = async (socket, rideId, rideType) => {
  const { role, id, trackingRideId, trackingRideType } = socket.data;

  const { ride, joinable } = await resolveRideForRoom(
    rideId,
    role === 'viewer' ? trackingRideType : rideType
  );

  if (!ride) return { ok: false, message: 'Ride not found' };
  if (!joinable) return { ok: false, message: 'This ride is no longer active' };

  const allowed =
    (role === 'driver' && String(ride.assignedTo) === String(id)) ||
    (role === 'user' && String(ride.bookedBy) === String(id)) ||
    role === 'admin' ||
    (role === 'viewer' && String(trackingRideId) === String(ride._id));

  if (!allowed) return { ok: false, message: 'Not a participant in this ride' };

  socket.join(rideRoomName(ride._id));
  if (role === 'driver') addActiveRide(socket, String(ride._id));

  return { ok: true, ride };
};

// Called on EVERY transition that closes the tracking window — completed, cancelled and expired,
// identically for both products.
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
    // Drop just this ride — a driver still running another one must keep broadcasting into it.
    s.data.activeRideIds = (s.data.activeRideIds || []).filter((id) => String(id) !== String(rideId));
  });

  io.in(room).socketsLeave(room);
};
