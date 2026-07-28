import { QuickRideBid } from '../models/quickRideBid.model.js';
import { env } from '../config/env.js';

const BID_POPULATE = [
  { path: 'requestedBy', select: 'name profileImageUrl phoneNumber' },
  { path: 'vehicleId', select: 'vehicleNumber vehicleName vehicleImages vehicleTypeId', populate: { path: 'vehicleTypeId' } },
];

export class QuickRideBidService {
  bidExpiry = () => new Date(Date.now() + env.BID_TTL_SECONDS * 1000);

  getBidById = async (id) => {
    return QuickRideBid.findById(id);
  };

  getBidByIdPopulated = async (id) => {
    return QuickRideBid.findById(id).populate(BID_POPULATE);
  };

  // Live bids only. Expired rows may still exist between sweeper ticks, so every read filters.
  getActiveBidsForRide = async (rideId) => {
    return QuickRideBid.find({
      quickRideId: rideId,
      requestStatus: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .sort({ fare: 1 })
      .populate(BID_POPULATE);
  };

  getActiveBidByDriver = async (rideId, driverId) => {
    return QuickRideBid.findOne({
      quickRideId: rideId,
      requestedBy: driverId,
      requestStatus: 'pending',
      expiresAt: { $gt: new Date() },
    });
  };

  getActiveBidsForDriver = async (driverId) => {
    return QuickRideBid.find({
      requestedBy: driverId,
      requestStatus: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .populate('quickRideId');
  };

  // Places a bid, replacing the driver's previous one on the same ride.
  // The re-bid rule ("must be lower than your own active bid") lives in the controller;
  // here we just guarantee a driver never holds two live bids on one ride.
  placeBid = async ({ quickRideId, requestedBy, vehicleId, fare }) => {
    await QuickRideBid.deleteMany({ quickRideId, requestedBy, requestStatus: 'pending' });

    return QuickRideBid.create({
      quickRideId,
      requestedBy,
      vehicleId,
      fare,
      expiresAt: this.bidExpiry(),
    });
  };

  // Marks the winner. expiresAt is unset so the sweeper and the Mongo TTL index can never
  // delete the one bid that matters.
  acceptBid = async (bidId) => {
    return QuickRideBid.findByIdAndUpdate(
      bidId,
      { requestStatus: 'accepted', $unset: { expiresAt: '' } },
      { new: true }
    ).populate(BID_POPULATE);
  };

  // Rejection is deletion — there is no stored 'rejected' bid.
  deleteBid = async (bidId) => {
    return QuickRideBid.findByIdAndDelete(bidId);
  };

  // Every other bid on a ride, returned before deletion so their drivers can be notified.
  deleteOtherBidsForRide = async (rideId, exceptBidId) => {
    const filter = { quickRideId: rideId, ...(exceptBidId ? { _id: { $ne: exceptBidId } } : {}) };
    const doomed = await QuickRideBid.find(filter).select('_id requestedBy');
    if (doomed.length) await QuickRideBid.deleteMany(filter);
    return doomed;
  };

  // A driver who just won a ride is busy, so their bids on OTHER rides are unfulfillable.
  // Returned so each affected rider can be told the bid is gone rather than watching it rot.
  deleteDriverBidsOnOtherRides = async (driverId, exceptRideId) => {
    const filter = {
      requestedBy: driverId,
      quickRideId: { $ne: exceptRideId },
      requestStatus: 'pending',
    };
    const doomed = await QuickRideBid.find(filter).select('_id quickRideId').populate('quickRideId', 'bookedBy');
    if (doomed.length) await QuickRideBid.deleteMany(filter);
    return doomed;
  };

  findExpiredBids = async () => {
    return QuickRideBid.find({ requestStatus: 'pending', expiresAt: { $lte: new Date() } })
      .select('_id quickRideId requestedBy')
      .populate('quickRideId', 'bookedBy');
  };

  deleteByIds = async (bidIds) => {
    return QuickRideBid.deleteMany({ _id: { $in: bidIds } });
  };
}
