import mongoose from 'mongoose';
import { Review } from '../models/review.model.js';
import { RECENT_REVIEW_LIMIT } from '../constants/review.constants.js';

// Reviews are public-facing, so the reviewer is shown by name and picture and nothing else —
// never their phone number.
const REVIEWER_POPULATE = { path: 'userId', select: 'name profileImageUrl' };
const DRIVER_POPULATE = { path: 'driverId', select: 'name profileImageUrl' };

// A driver with no reviews yet. averageRating is null rather than 0 because "not rated" and "rated
// zero" are different things to a rider choosing a bid — and zero is not even on the scale.
export const emptyReviewSummary = () => ({ averageRating: null, totalReviews: 0, recentReviews: [] });

export class ReviewService {
  // A rider holds one review per driver, so writing again edits the existing one. The unique index
  // on (userId, driverId) is what makes this upsert safe against two concurrent submits — one
  // inserts, the other matches and updates.
  upsertReview = async ({ userId, driverId, rating, comment }) => {
    return Review.findOneAndUpdate(
      { userId, driverId },
      { rating, comment: comment ?? '' },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate(REVIEWER_POPULATE);
  };

  getReviewById = async (id) => {
    return Review.findById(id);
  };

  getReviewByUserForDriver = async (userId, driverId) => {
    return Review.findOne({ userId, driverId }).populate(REVIEWER_POPULATE);
  };

  getReviewsForDriver = async (driverId, { limit, skip = 0 } = {}) => {
    return Review.find({ driverId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(REVIEWER_POPULATE);
  };

  getReviewsByUser = async (userId) => {
    return Review.find({ userId }).sort({ createdAt: -1 }).populate(DRIVER_POPULATE);
  };

  // Scoped by userId in the predicate, so a rider cannot delete someone else's review by guessing
  // an id — there is no read-then-check window to lose.
  deleteReviewForUser = async (id, userId) => {
    return Review.findOneAndDelete({ _id: id, userId });
  };

  // Rating + recent reviews for MANY drivers in a fixed number of queries, keyed by driver id.
  //
  // This is what the bid payloads call, once per bid list, on both ride modules. Doing it per
  // driver would be an N+1 on the hottest read there is, so both halves below are $in queries and
  // the grouping happens here.
  getDriverSummaries = async (driverIds, { recentLimit = RECENT_REVIEW_LIMIT } = {}) => {
    const ids = [...new Set((driverIds || []).filter(Boolean).map(String))]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const summaries = new Map();
    if (!ids.length) return summaries;

    const [stats, recent] = await Promise.all([
      Review.aggregate([
        { $match: { driverId: { $in: ids } } },
        { $group: { _id: '$driverId', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
      ]),
      this.getRecentReviewsForDrivers(ids, recentLimit),
    ]);

    stats.forEach((row) => {
      summaries.set(String(row._id), {
        // One decimal place. A rating rendered as 4.333333 tells a rider nothing extra.
        averageRating: Math.round(row.averageRating * 10) / 10,
        totalReviews: row.totalReviews,
        recentReviews: [],
      });
    });

    recent.forEach((review) => {
      summaries.get(String(review.driverId))?.recentReviews.push(review);
    });

    return summaries;
  };

  getDriverSummary = async (driverId, options) => {
    const summaries = await this.getDriverSummaries([driverId], options);
    return summaries.get(String(driverId)) ?? emptyReviewSummary();
  };

  // The newest N reviews *per driver*, for a whole set of drivers, in one query.
  //
  // $setWindowFields ranks inside each driver's own partition, so the limit is applied per driver
  // rather than across the result. The obvious alternative — $group with $push then $slice —
  // materialises every review a driver has ever received into one array in order to throw all but
  // ten of them away, which for a busy driver is both slow and a real risk of the 16MB document cap.
  getRecentReviewsForDrivers = async (driverIds, limit) => {
    const rows = await Review.aggregate([
      { $match: { driverId: { $in: driverIds } } },
      {
        $setWindowFields: {
          partitionBy: '$driverId',
          sortBy: { createdAt: -1 },
          output: { position: { $documentNumber: {} } },
        },
      },
      { $match: { position: { $lte: limit } } },
      { $sort: { driverId: 1, createdAt: -1 } },
      { $project: { driverId: 1, userId: 1, rating: 1, comment: 1, createdAt: 1 } },
    ]);

    // Aggregation output is plain objects, so the reviewer has to be joined after the fact.
    // Model.populate does it for the whole batch in one query.
    return Review.populate(rows, REVIEWER_POPULATE);
  };

  countForDriver = async (driverId) => {
    return Review.countDocuments({ driverId });
  };
}
