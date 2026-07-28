import mongoose from 'mongoose';

// Bids are ephemeral by design: they live BID_TTL_SECONDS and are then hard-deleted.
// There is no 'rejected' state — losing an accept, a ride expiring, or a rider dismissing
// a bid all delete the row. Nothing here is tombstoned.
const quickRideBidSchema = new mongoose.Schema(
  {
    quickRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuickRide',
      required: [true, 'Ride is required'],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required'],
    },
    // Snapshot of which vehicle bid, so the rider sees it without a second lookup
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    fare: {
      type: Number,
      required: [true, 'Fare is required'],
      min: [0, 'Fare cannot be negative'],
    },
    requestStatus: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry is required'],
    },
  },
  { timestamps: true }
);

// No unique index on (quickRideId, requestedBy) — a driver may re-bid to lower their fare,
// and the "must be lower than your own active bid" rule is enforced in the service.
quickRideBidSchema.index({ quickRideId: 1, requestStatus: 1 });
quickRideBidSchema.index({ requestedBy: 1, quickRideId: 1 });
quickRideBidSchema.index({ requestedBy: 1, createdAt: -1 });

// Backstop only. Mongo's TTL monitor runs about once a minute, far too coarse for a 60s bid —
// the expiry sweeper is what enforces the deadline on time. This catches rows orphaned by a crash.
// Accepted bids get expiresAt unset so this can never delete a winning bid.
quickRideBidSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const QuickRideBid = mongoose.model('QuickRideBid', quickRideBidSchema);
