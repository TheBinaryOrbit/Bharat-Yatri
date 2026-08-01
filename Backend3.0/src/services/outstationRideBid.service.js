import { OutstationRideBid } from '../models/outstationRideBid.model.js';

const BID_POPULATE = [
  { path: 'requestedBy', select: 'name profileImageUrl phoneNumber' },
  {
    path: 'vehicleId',
    select: 'vehicleNumber vehicleName vehicleImages vehicleTypeId',
    populate: { path: 'vehicleTypeId' },
  },
];

// The QuickRide bid service with every trace of expiry removed — no bidExpiry(), no
// `expiresAt: { $gt: now }` filter on the reads, no findExpiredBids for the sweeper to call.
// An outstation bid is only ever ended by an explicit action: the ride is assigned, cancelled or
// expires, the driver withdraws, or the rider dismisses it.
export class OutstationRideBidService {
  getBidById = async (id) => {
    return OutstationRideBid.findById(id);
  };

  getBidByIdPopulated = async (id) => {
    return OutstationRideBid.findById(id).populate(BID_POPULATE);
  };

  getActiveBidsForRide = async (rideId) => {
    return OutstationRideBid.find({ outstationRideId: rideId, requestStatus: 'pending' })
      .sort({ fare: 1 })
      .populate(BID_POPULATE);
  };

  // Bids across several rides in ONE query. The rider's live view can hold many searching rides at
  // once, and grouping here is what keeps that endpoint from issuing a query per ride.
  getActiveBidsForRides = async (rideIds) => {
    if (!rideIds?.length) return [];

    return OutstationRideBid.find({ outstationRideId: { $in: rideIds }, requestStatus: 'pending' })
      .sort({ fare: 1 })
      .populate(BID_POPULATE);
  };

  getActiveBidByDriver = async (rideId, driverId) => {
    return OutstationRideBid.findOne({
      outstationRideId: rideId,
      requestedBy: driverId,
      requestStatus: 'pending',
    });
  };

  getActiveBidsForDriver = async (driverId) => {
    return OutstationRideBid.find({ requestedBy: driverId, requestStatus: 'pending' })
      .sort({ createdAt: -1 })
      .populate('outstationRideId');
  };

  // Places a bid, replacing the driver's previous one on the same ride.
  // The re-bid rule ("must be lower than your own active bid") lives in the controller;
  // here we just guarantee a driver never holds two live bids on one ride.
  placeBid = async ({ outstationRideId, requestedBy, vehicleId, fare }) => {
    await OutstationRideBid.deleteMany({ outstationRideId, requestedBy, requestStatus: 'pending' });

    return OutstationRideBid.create({ outstationRideId, requestedBy, vehicleId, fare });
  };

  // Marks the winner. Nothing to unset — there was never an expiry to protect it from.
  acceptBid = async (bidId) => {
    return OutstationRideBid.findByIdAndUpdate(bidId, { requestStatus: 'accepted' }, { new: true }).populate(
      BID_POPULATE
    );
  };

  // Rejection is deletion — there is no stored 'rejected' bid.
  deleteBid = async (bidId) => {
    return OutstationRideBid.findByIdAndDelete(bidId);
  };

  // Every other bid on a ride, returned before deletion so their drivers can be notified.
  deleteOtherBidsForRide = async (rideId, exceptBidId) => {
    const filter = { outstationRideId: rideId, ...(exceptBidId ? { _id: { $ne: exceptBidId } } : {}) };
    const doomed = await OutstationRideBid.find(filter).select('_id requestedBy');
    if (doomed.length) await OutstationRideBid.deleteMany(filter);
    return doomed;
  };

  // A driver who just won a trip holds their single outstation slot, so their bids on OTHER rides
  // are unfulfillable. Returned so each affected rider can be told the bid is gone — and here that
  // matters more than it does on QuickRide, where an unfulfillable bid would have expired in a
  // minute anyway. These would otherwise sit on the rider's screen indefinitely.
  deleteDriverBidsOnOtherRides = async (driverId, exceptRideId) => {
    const filter = {
      requestedBy: driverId,
      outstationRideId: { $ne: exceptRideId },
      requestStatus: 'pending',
    };
    const doomed = await OutstationRideBid.find(filter)
      .select('_id outstationRideId')
      .populate('outstationRideId', 'bookedBy');
    if (doomed.length) await OutstationRideBid.deleteMany(filter);
    return doomed;
  };
}
