import mongoose from 'mongoose';
import { MIN_RATING, MAX_RATING, MAX_COMMENT_LENGTH } from '../constants/review.constants.js';

// A rider's verdict on a driver. Deliberately keyed on the pair (rider, driver) rather than on a
// ride: a regular who rides with the same driver every week holds one opinion, not forty, and the
// unique index below makes re-reviewing an edit instead of a second row. The controller still
// requires a completed ride between the two before the first review can be written, so the pair
// key does not weaken the "you must have actually ridden with them" rule.
const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [MIN_RATING, `Rating must be at least ${MIN_RATING}`],
      max: [MAX_RATING, `Rating cannot be more than ${MAX_RATING}`],
      // Half stars would make the average lie about what riders can actually express.
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_COMMENT_LENGTH, `Comment cannot be longer than ${MAX_COMMENT_LENGTH} characters`],
    },
  },
  { timestamps: true }
);

// One review per rider per driver. This IS the edit-not-duplicate rule — upsertReview relies on it.
reviewSchema.index({ userId: 1, driverId: 1 }, { unique: true });

// Serves both driver-facing reads: the rating aggregation ($match on driverId) and the newest-first
// list, whose sort is satisfied from the key rather than in memory.
reviewSchema.index({ driverId: 1, createdAt: -1 });

// The rider's own "reviews I have written" list.
reviewSchema.index({ userId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
