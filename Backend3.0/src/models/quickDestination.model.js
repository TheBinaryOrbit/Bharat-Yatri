import mongoose from 'mongoose';
import { MAX_TAG_LENGTH } from '../constants/destination.constants.js';

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

// A rider's saved shortcut — "Home", "Office" — so booking a routine trip is one tap instead of a
// search. Stored as a point in the same GeoJSON shape as a ride's dropCoordinates so it can be
// handed straight to a ride booking with no conversion.
//
// There is deliberately no 2dsphere index: nothing ever searches shortcuts by proximity. They are
// only ever read as one rider's short list.
const quickDestinationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    tag: {
      type: String,
      required: [true, 'Tag is required'],
      trim: true,
      maxlength: [MAX_TAG_LENGTH, `Tag cannot be longer than ${MAX_TAG_LENGTH} characters`],
    },
    dropLocationName: {
      type: String,
      required: [true, 'Drop location name is required'],
      trim: true,
    },
    dropCoordinates: {
      type: pointSchema,
      required: [true, 'Drop coordinates are required'],
    },
  },
  { timestamps: true }
);

// One tag per rider — two shortcuts both labelled "Home" is a list nobody can use. Case is NOT
// folded here, so "Home" and "home" are distinct; the controller trims but does not lowercase,
// because the tag is shown back to the rider exactly as they typed it.
quickDestinationSchema.index({ userId: 1, tag: 1 }, { unique: true });

// The list read, newest first.
quickDestinationSchema.index({ userId: 1, createdAt: -1 });

export const QuickDestination = mongoose.model('QuickDestination', quickDestinationSchema);
