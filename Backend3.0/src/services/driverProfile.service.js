import { ReviewService, emptyReviewSummary } from './review.service.js';

// The driver card a rider sees on a bid: who is offering, what other riders made of them, and what
// the vehicle looks like.
//
// It lives here rather than in either bid controller because BOTH ride modules attach the identical
// block — a rider comparing a QuickRide bid against an outstation bid must not be shown two
// different cards — and because the rating half needs batching that a controller has no business
// owning.
export class DriverProfileService {
  constructor() {
    this.reviewService = new ReviewService();
  }

  // Decorates a whole bid list. Ratings for every bidding driver come back in one round trip:
  // this runs on bid:new (a socket push) and on every read of a ride's bid list, so a per-driver
  // query here would land on the hottest endpoints in the app.
  attachToBids = async (bids) => {
    if (!bids?.length) return [];

    const driverIds = bids.map((bid) => bid.requestedBy?._id ?? bid.requestedBy).filter(Boolean);
    const summaries = await this.reviewService.getDriverSummaries(driverIds);

    return bids.map((bid) => this.decorate(bid, summaries));
  };

  attachToBid = async (bid) => {
    if (!bid) return bid;
    const [decorated] = await this.attachToBids([bid]);
    return decorated;
  };

  // A mongoose document only carries fields its schema declares — assigning `driver` to one is
  // silently dropped. So the bid becomes a plain object first, and the caller gets that back.
  // Every existing field is preserved: this only adds.
  decorate = (bid, summaries) => {
    const plain = typeof bid?.toObject === 'function' ? bid.toObject() : { ...bid };

    const driver = bid.requestedBy;
    const driverId = String(driver?._id ?? driver ?? '');
    const summary = summaries.get(driverId) ?? emptyReviewSummary();

    plain.driver = {
      driverId,
      name: driver?.name ?? null,
      profileImageUrl: driver?.profileImageUrl ?? '',
      // vehicleId is already populated on every bid read; this just lifts the first image out of
      // the array so the card does not have to know the vehicle's shape to render a thumbnail.
      vehicleImageUrl: bid.vehicleId?.vehicleImages?.[0] ?? '',
      averageRating: summary.averageRating,
      totalReviews: summary.totalReviews,
      recentReviews: summary.recentReviews,
    };

    return plain;
  };
}
