import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { BOOKING_TYPES, OUTSTATION_RIDE_STATUSES } from '../constants/ride.constants.js';

// GeoJSON point. Mongo stores coordinates as [longitude, latitude] — not the other way round.
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: [true, 'Coordinates are required'],
    },
  },
  { _id: false }
);

// A long-distance, optionally scheduled trip. Deliberately a separate collection from QuickRide
// rather than a discriminator: the two share a field list but not a lifecycle, and the differences
// (a scheduled departure, a 24h auction, non-expiring bids, a tracking window that opens and shuts
// mid-ride) are exactly the things a shared schema would have to make conditional.
const outstationRideSchema = new mongoose.Schema(
  {
    pickupLocationName: {
      type: String,
      required: [true, 'Pickup location name is required'],
      trim: true,
    },
    dropLocationName: {
      type: String,
      required: [true, 'Drop location name is required'],
      trim: true,
    },
    pickupCoordinates: {
      type: pointSchema,
      required: [true, 'Pickup coordinates are required'],
    },
    dropCoordinates: {
      type: pointSchema,
      required: [true, 'Drop coordinates are required'],
    },
    vehicleTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      required: [true, 'Vehicle type is required'],
    },
    // The mirror image of QuickRide's `max`, and there is deliberately no upper bound — an
    // outstation trip is whatever the road is. The two ranges touch at exactly
    // OUTSTATION_MIN_DISTANCE_KM (= MAX_RIDE_DISTANCE_KM by default) and both checks are
    // inclusive, so a 100 km trip is bookable either way: a rider must never be told a route is
    // too long here and too short there.
    estimatedDistanceKm: {
      type: Number,
      required: [true, 'Estimated distance is required'],
      min: [
        env.OUTSTATION_MIN_DISTANCE_KM,
        `Outstation rides must be at least ${env.OUTSTATION_MIN_DISTANCE_KM} km`,
      ],
    },
    estimatedDurationMin: {
      type: Number,
      required: [true, 'Estimated duration is required'],
    },
    // System estimate from the vehicle type's rates. Never changes once set.
    suggestedFare: {
      type: Number,
      required: [true, 'Suggested fare is required'],
    },
    // What the rider is offering. Starts at suggestedFare; the rider can raise it (never lower).
    offeredFare: {
      type: Number,
      required: [true, 'Offered fare is required'],
    },
    fareUpdateCount: {
      type: Number,
      default: 0,
    },
    // 'now' is a hail: pickupAt is the moment the ride was created, and the expiry cap does not
    // apply to it. 'later' is a booking: pickupAt is a real future instant and doubles as the
    // ride's hard deadline — a trip cannot still be looking for a driver after it was due to leave.
    bookingType: {
      type: String,
      enum: BOOKING_TYPES,
      default: 'now',
    },
    // When the trip is due to leave. Drives the expiry cap, the QuickRide block window and the
    // browse ordering — which is why it appears in three of the indexes below.
    pickupAt: {
      type: Date,
      required: [true, 'Pickup time is required'],
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking user is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    acceptedBidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OutstationRideBid',
      default: null,
    },
    finalFare: {
      type: Number,
      default: null,
    },
    // 'arriving' is the leg between the driver setting off and the rider getting in — the one
    // window this ride has a room, a tracking token and a live position.
    // 'expired' is the auto-cancel state (nobody acted); 'cancelled' is deliberate.
    rideStatus: {
      type: String,
      enum: OUTSTATION_RIDE_STATUSES,
      default: 'searching',
    },
    cancelledBy: {
      type: String,
      enum: ['user', 'driver'],
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry is required'],
    },
    // Shown to the rider, entered by the driver to confirm the pickup.
    // select:false keeps it out of every ordinary query, so it cannot leak to the driver by
    // accident — the rider-facing reads opt in explicitly with .select('+startOtp').
    startOtp: {
      type: String,
      default: null,
      select: false,
    },
    startOtpAttempts: {
      type: Number,
      default: 0,
    },
    // When the driver set off for pickup — the moment the tracking window opened.
    arrivingAt: {
      type: Date,
      default: null,
    },
    // When the rider was actually picked up. Same meaning as QuickRide's startedAt: the trip began.
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Credential for the shareable live-tracking link. Minted when the driver sets off and nulled
    // the instant the rider is aboard, so a shared link covers the approach and nothing else.
    trackingToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

outstationRideSchema.index({ pickupCoordinates: '2dsphere' });
outstationRideSchema.index({ rideStatus: 1, vehicleTypeId: 1, pickupAt: 1 }); // the /available filter
outstationRideSchema.index({ rideStatus: 1, expiresAt: 1 }); // drives the expiry sweeper
outstationRideSchema.index({ bookedBy: 1, createdAt: -1 });
outstationRideSchema.index({ assignedTo: 1, createdAt: -1 });
// Serves BOTH availability constraints: {assignedTo, rideStatus} is a prefix of this key, so the
// "one active outstation ride" check and the "pickup within the block window" check share one
// index. Do not add a separate two-field version.
outstationRideSchema.index({ assignedTo: 1, rideStatus: 1, pickupAt: 1 });
outstationRideSchema.index({ pickupAt: 1 }); // travel-date history sort
outstationRideSchema.index({ trackingToken: 1 }, { sparse: true });

export const OutstationRide = mongoose.model('OutstationRide', outstationRideSchema);
