import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { QuickRide } from '../models/quickRide.model.js';
import { Vehicle } from '../models/vehicle.model.js';
import { DriverLocationService } from '../services/driverLocation.service.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { isValidCoordinate } from '../utils/geo.js';
import { setIO } from './io.js';
import { joinRideRoom } from './rideRoom.js';
import {
  ACTIVE_RIDE_STATUSES,
  rideRoomName,
  driverRoomName,
  userRoomName,
} from '../constants/ride.constants.js';

const driverLocationService = new DriverLocationService();
const quickRideService = new QuickRideService();

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

  // A shared tracking link is scoped to exactly one ride, for as long as that ride is active.
  if (trackingToken) {
    const ride = await QuickRide.findOne({
      trackingToken,
      rideStatus: { $in: ACTIVE_RIDE_STATUSES },
    }).select('_id');
    if (!ride) throw new Error('Invalid or expired tracking link');

    return {
      id: `viewer:${ride._id}`,
      role: 'viewer',
      canPublish: false,
      trackingRideId: String(ride._id),
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
      if (!isValidCoordinate(latitude, longitude)) return;
      if (!(await driverLocationService.isPlausibleJump(driverId, latitude, longitude))) return;

      await driverLocationService.upsertLocation({
        driverId,
        latitude,
        longitude,
        meta: { name: socket.data.name, ...(socket.data.vehicle || {}) },
      });

      const rideId = socket.data.activeRideId;
      if (!rideId) return;

      io.to(rideRoomName(rideId)).emit('ride:location', {
        rideId,
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        at: Date.now(),
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

  socket.on('disconnect', async () => {
    try {
      await driverLocationService.goOffline(driverId);
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

    // A driver who lost signal mid-trip resumes broadcasting without the client re-issuing ride:join.
    if (role === 'driver' || role === 'user') {
      try {
        const activeRide = await quickRideService.getActiveRideForParticipant(id);
        if (activeRide) {
          socket.join(rideRoomName(activeRide._id));
          if (role === 'driver') socket.data.activeRideId = String(activeRide._id);
          socket.emit('ride:rejoined', { rideId: String(activeRide._id), rideStatus: activeRide.rideStatus });
        }
      } catch (error) {
        console.error('ride room rejoin error:', error.message);
      }
    }

    // Late joiners: a tracking link opened mid-trip, an admin opening a ride, a reconnecting client.
    socket.on('ride:join', async ({ rideId } = {}, ack) => {
      try {
        if (!rideId) return ack?.({ ok: false, message: 'rideId is required' });

        const result = await joinRideRoom(socket, rideId);
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
  });

  console.log('✅ Socket.IO initialised');
  return io;
};
