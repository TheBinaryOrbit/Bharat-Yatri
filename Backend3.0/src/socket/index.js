import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { QuickRide } from '../models/quickRide.model.js';
import { OutstationRide } from '../models/outstationRide.model.js';
import { Vehicle } from '../models/vehicle.model.js';
import { DriverLocationService } from '../services/driverLocation.service.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { isValidCoordinate } from '../utils/geo.js';
import { setIO } from './io.js';
import { joinRideRoom } from './rideRoom.js';
import {
  ACTIVE_RIDE_STATUSES,
  OUTSTATION_TRACKABLE_RIDE_STATUSES,
  rideRoomName,
  driverRoomName,
  userRoomName,
} from '../constants/ride.constants.js';

const driverLocationService = new DriverLocationService();
const quickRideService = new QuickRideService();
const outstationRideService = new OutstationRideService();

// Resolves whichever credential the client presented onto socket.data.
//
// Three kinds are accepted. Only the first can publish; admins and tracking links are strictly
// consumers, which is what stops any direct passenger-to-driver channel from existing.
const authenticate = async (socket) => {
  const { token, adminKey, trackingToken } = socket.handshake.auth || {};

  if (token) {
    const decoded = verifyToken(token); // { id, role }
    const Model = decoded.role === 'driver' ? Driver : User;
    const account = await Model.findById(decoded.id);
    if (!account) throw new Error('Account not found');

    return {
      id: String(account._id),
      role: decoded.role === 'driver' ? 'driver' : 'user',
      name: account.name,
      canPublish: true,
    };
  }

  // Reuses the existing x-admin-key gate rather than inventing a second admin auth scheme.
  // When admin JWTs arrive, this is the one place to change.
  if (adminKey) {
    if (!env.ADMIN_API_KEY || adminKey !== env.ADMIN_API_KEY) throw new Error('Invalid admin key');
    return { id: 'admin', role: 'admin', canPublish: false };
  }

  // A shared tracking link is scoped to exactly one ride, for as long as that ride is trackable.
  //
  // This is the ONE place the ride type cannot be supplied by the client — a share link is an
  // opaque token and nothing more. (The REST side has no such problem: /quick-rides/track/:token
  // and /outstation-rides/track/:token are separate routes.) So both collections are tried,
  // QuickRide first because it is far more common, which means the second query is usually never
  // issued. Both have a sparse trackingToken index, so a miss is one index probe.
  if (trackingToken) {
    let ride = await QuickRide.findOne({
      trackingToken,
      rideStatus: { $in: ACTIVE_RIDE_STATUSES },
    }).select('_id');
    let trackingRideType = 'quickride';

    if (!ride) {
      // 'arriving' + 'in_progress': an outstation link is live from the driver setting off until
      // the trip ends. The token is nulled at every terminal transition too, so this predicate is
      // the belt to that braces rather than the only thing standing between a stale link and a
      // finished trip.
      ride = await OutstationRide.findOne({
        trackingToken,
        rideStatus: { $in: OUTSTATION_TRACKABLE_RIDE_STATUSES },
      }).select('_id');
      trackingRideType = 'outstation';
    }

    if (!ride) throw new Error('Invalid or expired tracking link');

    return {
      id: `viewer:${ride._id}`,
      role: 'viewer',
      canPublish: false,
      trackingRideId: String(ride._id),
      trackingRideType,
    };
  }

  throw new Error('No credentials provided');
};

const registerDriverHandlers = (io, socket) => {
  const driverId = socket.data.id;

  // Announces the driver as available and seeds their position.
  socket.on('driver:online', async ({ latitude, longitude } = {}, ack) => {
    try {
      if (!isValidCoordinate(latitude, longitude)) {
        return ack?.({ ok: false, message: 'Invalid coordinates' });
      }

      const driver = await Driver.findById(driverId).select('name isKycCompleted');
      if (!driver?.isKycCompleted) {
        return ack?.({ ok: false, message: 'Complete your KYC before going online' });
      }

      const vehicle = await Vehicle.findOne({ driverId }).populate('vehicleTypeId');
      if (!vehicle) {
        return ack?.({ ok: false, message: 'Register a vehicle before going online' });
      }

      // Cached so the 5s location pings do not re-query the vehicle every time
      socket.data.vehicle = {
        vehicleId: String(vehicle._id),
        vehicleTypeId: String(vehicle.vehicleTypeId?._id ?? vehicle.vehicleTypeId),
        vehicleNumber: vehicle.vehicleNumber,
      };

      await driverLocationService.upsertLocation({
        driverId,
        latitude,
        longitude,
        meta: { name: driver.name, ...socket.data.vehicle },
      });

      return ack?.({ ok: true });
    } catch (error) {
      console.error('driver:online error:', error.message);
      return ack?.({ ok: false, message: 'Could not go online' });
    }
  });

  // The app pings every 5s. This single event does double duty: it maintains the dispatch
  // index AND, when the driver is on a ride, feeds the ride room. No second event or cadence.
  socket.on('driver:location', async ({ latitude, longitude, heading, speed } = {}) => {
    try {

      // Invalid or implausible fixes are dropped silently — never broadcast, never stored.
      if (!isValidCoordinate(latitude, longitude)) {
        return;
      }
      if (!(await driverLocationService.isPlausibleJump(driverId, latitude, longitude))) {
        return;
      }

      await driverLocationService.upsertLocation({
        driverId,
        latitude,
        longitude,
        meta: { name: socket.data.name, ...(socket.data.vehicle || {}) },
      });

      // Plural: a driver can be inside two ride rooms at once — an outstation trip they are
      // driving to and a QuickRide accepted before the outstation block window closed. Each room
      // gets the same fix, tagged with its own rideId.
      const rideIds = socket.data.activeRideIds || [];
      if (!rideIds.length) return;

      const at = Date.now();
      rideIds.forEach((rideId) => {
        io.to(rideRoomName(rideId)).emit('ride:location', {
          rideId,
          latitude,
          longitude,
          heading: heading ?? null,
          speed: speed ?? null,
          at,
        });
      });
    } catch (error) {
      console.error('driver:location error:', error.message);
    }
  });

  socket.on('driver:offline', async (_payload, ack) => {
    try {
      await driverLocationService.goOffline(driverId);
      return ack?.({ ok: true });
    } catch (error) {
      console.error('driver:offline error:', error.message);
      return ack?.({ ok: false });
    }
  });

  // A dropped socket is not "going offline". The entry is parked for the grace window so the
  // driver comes straight back; only an explicit driver:offline (or the window closing) evicts it.
  //
  // Checked against the driver's remaining sockets first: on a two-device session, one tab closing
  // must not park a driver who is still connected elsewhere.
  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(driverRoomName(driverId)).fetchSockets();
      if (remaining.length) return;

      await driverLocationService.beginDisconnectGrace(driverId);
    } catch (error) {
      console.error('driver disconnect cleanup error:', error.message);
    }
  });
};

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  setIO(io);

  io.use(async (socket, next) => {
    try {
      Object.assign(socket.data, await authenticate(socket));
      next();
    } catch (error) {
      next(new Error(`Unauthorized: ${error.message}`));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.data;

    // Room per identity, not a socket-id map: multi-device works and it survives reconnects.
    if (role === 'driver') socket.join(driverRoomName(id));
    if (role === 'user') socket.join(userRoomName(id));

    // EVERY listener is registered before the first await below. Apps emit the instant they
    // connect — an event that arrives while this handler is still awaiting a database or Redis
    // round-trip has no listener yet and is dropped on the floor, ack and all. Registering first
    // costs nothing and closes that window.

    // Late joiners: a tracking link opened mid-trip, an admin opening a ride, a reconnecting client.
    //
    // `rideType` is optional and defaults to 'quickride', so already-shipped apps keep working.
    // An outstation client must send 'outstation' — a mismatched type resolves to "Ride not found"
    // rather than being silently absorbed, which is the behaviour we want from a client bug.
    socket.on('ride:join', async ({ rideId, rideType } = {}, ack) => {
      try {
        if (!rideId) return ack?.({ ok: false, message: 'rideId is required' });

        const result = await joinRideRoom(socket, rideId, rideType);
        if (!result.ok) {
          socket.emit('ride:join_error', { rideId, message: result.message });
          return ack?.(result);
        }

        // A joiner should see the vehicle immediately rather than a blank map for up to 5s.
        if (result.ride.assignedTo) {
          const last = await driverLocationService.getLastLocation(result.ride.assignedTo);
          if (last) {
            socket.emit('ride:location', {
              rideId: String(rideId),
              latitude: last.latitude,
              longitude: last.longitude,
              heading: null,
              speed: null,
              at: last.at,
            });
          }
        }

        return ack?.({ ok: true });
      } catch (error) {
        console.error('ride:join error:', error.message);
        return ack?.({ ok: false, message: 'Could not join ride' });
      }
    });

    socket.on('ride:leave', ({ rideId } = {}) => {
      if (rideId) socket.leave(rideRoomName(rideId));
    });

    // Only the assigned driver ever publishes into a ride room.
    if (role === 'driver' && socket.data.canPublish) {
      registerDriverHandlers(io, socket);
    }

    // ── async resume work, safe to run now that nothing can be missed ──────────────────

    // Reconnected inside the grace window: reinstate the parked Redis entry and hand back the
    // cached vehicle metadata, so the app is discoverable again without re-issuing driver:online.
    if (role === 'driver') {
      try {
        const resumed = await driverLocationService.resumeFromGrace(id);
        if (resumed) {
          socket.data.vehicle = {
            vehicleId: resumed.vehicleId,
            vehicleTypeId: resumed.vehicleTypeId,
            vehicleNumber: resumed.vehicleNumber,
          };
          socket.emit('driver:resumed', {
            latitude: Number(resumed.latitude),
            longitude: Number(resumed.longitude),
            offlineForMs: resumed.disconnectedAt ? Date.now() - Number(resumed.disconnectedAt) : null,
          });
        }
      } catch (error) {
        console.error('driver resume error:', error.message);
      }
    }

    // A driver who lost signal mid-trip resumes broadcasting without the client re-issuing
    // ride:join. Both products are checked, and both rooms are rejoined if both apply — the
    // rideType field on the event tells the app which screen to restore. Adding a field is
    // backwards-compatible; an older client simply ignores it.
    if (role === 'driver' || role === 'user') {
      try {
        const [quickRide, outstationRide] = await Promise.all([
          quickRideService.getActiveRideForParticipant(id),
          // 'arriving' or 'in_progress' — an assigned-but-not-departed outstation ride has no room
          // to rejoin, because nothing is moving yet.
          outstationRideService.getRoomEligibleRideForParticipant(id),
        ]);

        for (const [ride, rideType] of [
          [quickRide, 'quickride'],
          [outstationRide, 'outstation'],
        ]) {
          if (!ride) continue;

          socket.join(rideRoomName(ride._id));
          if (role === 'driver') {
            socket.data.activeRideIds = [...(socket.data.activeRideIds || []), String(ride._id)];
          }
          socket.emit('ride:rejoined', {
            rideId: String(ride._id),
            rideType,
            rideStatus: ride.rideStatus,
          });
        }
      } catch (error) {
        console.error('ride room rejoin error:', error.message);
      }
    }
  });

  console.log('✅ Socket.IO initialised');
  return io;
};
