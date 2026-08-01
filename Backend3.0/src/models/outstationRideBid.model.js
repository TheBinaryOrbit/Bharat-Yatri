import mongoose from 'mongoose';

// Like a QuickRide bid, this is never tombstoned — there is no 'rejected' state, and losing an
// accept, a ride expiring, a driver withdrawing or a rider dismissing all delete the row.
//
// Unlike a QuickRide bid, it has NO expiresAt, no TTL index and nothing sweeps it. A QuickRide bid
// dies in 60 seconds because a rider staring at a map wants a short, live auction. An outstation
// bid may be placed on a trip three days out and has to still be there when the rider opens the
// app that evening, so every way one dies is an explicit action by someone.
const outstationRideBidSchema = new mongoose.Schema(
  {
    outstationRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OutstationRide',
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
  },
  { timestamps: true }
);

// No unique index on (outstationRideId, requestedBy) — a driver may re-bid to lower their fare,
// and the "must be lower than your own active bid" rule is enforced in the service.
outstationRideBidSchema.index({ outstationRideId: 1, requestStatus: 1 });
outstationRideBidSchema.index({ requestedBy: 1, outstationRideId: 1 });
// requestStatus is in the key here, unlike QuickRide's {requestedBy, createdAt}: without an expiry
// sweep the pending set is the only thing that ever shrinks, and every read of a driver's bids
// filters on it.
outstationRideBidSchema.index({ requestedBy: 1, requestStatus: 1, createdAt: -1 });

export const OutstationRideBid = mongoose.model('OutstationRideBid', outstationRideBidSchema);
