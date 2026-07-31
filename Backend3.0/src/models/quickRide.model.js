import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { RIDE_STATUSES } from '../constants/ride.constants.js';

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

const quickRideSchema = new mongoose.Schema(
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
    estimatedDistanceKm: {
      type: Number,
      required: [true, 'Estimated distance is required'],
      max: [env.MAX_RIDE_DISTANCE_KM, `Ride distance cannot exceed ${env.MAX_RIDE_DISTANCE_KM} km`],
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
      ref: 'QuickRideBid',
      default: null,
    },
    finalFare: {
      type: Number,
      default: null,
    },
    // 'expired' is the auto-cancel state (nobody acted); 'cancelled' is deliberate and carries cancelledBy.
    rideStatus: {
      type: String,
      enum: RIDE_STATUSES,
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
    // Shown to the rider, entered by the driver to start the trip.
    // select:false keeps it out of every ordinary query, so it cannot leak to the driver by accident —
    // the one rider-facing read opts in explicitly with .select('+startOtp').
    startOtp: {
      type: String,
      default: null,
      select: false,
    },
    startOtpAttempts: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Credential for the shareable live-tracking link. Nulled on teardown so a shared link dies with the ride.
    trackingToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

quickRideSchema.index({ pickupCoordinates: '2dsphere' });
quickRideSchema.index({ rideStatus: 1, vehicleTypeId: 1, createdAt: -1 });
quickRideSchema.index({ rideStatus: 1, expiresAt: 1 }); // drives the expiry sweeper
quickRideSchema.index({ bookedBy: 1, createdAt: -1 });
quickRideSchema.index({ assignedTo: 1, createdAt: -1 }); // also serves the busy check
quickRideSchema.index({ trackingToken: 1 }, { sparse: true });

export const QuickRide = mongoose.model('QuickRide', quickRideSchema);
