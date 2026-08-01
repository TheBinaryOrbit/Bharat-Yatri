import mongoose from 'mongoose';
import { ReviewService } from '../services/review.service.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { DriverService } from '../services/driver.service.js';
import {
  MIN_RATING,
  MAX_RATING,
  DRIVER_REVIEW_PAGE_SIZE,
  DRIVER_REVIEW_MAX_PAGE_SIZE,
} from '../constants/review.constants.js';

export class ReviewController {
  constructor() {
    this.reviewService = new ReviewService();
    this.quickRideService = new QuickRideService();
    this.outstationRideService = new OutstationRideService();
    this.vehicleService = new VehicleService();
    this.driverService = new DriverService();
  }

  // POST /api/v3/reviews  (protected — user only)
  //
  // Creates or edits the rider's review of a driver. A rider holds one review per driver, so
  // posting twice edits rather than stacks — which is why this answers 200 on an edit and 201 on a
  // first review, and the app does not need a separate update call.
  createReview = async (req, res) => {
    // Reviewer is taken from the auth token, never the request body
    const userId = req.user._id;
    const { driverId, comment } = req.body;
    const rating = Number(req.body.rating);

    const errors = [];
    if (!driverId) {
      errors.push({ field: 'driverId', message: 'Driver is required' });
    } else if (!mongoose.isValidObjectId(driverId)) {
      errors.push({ field: 'driverId', message: 'driverId is not a valid id' });
    }

    if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
      errors.push({
        field: 'rating',
        message: `rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}`,
      });
    }

    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const driver = await this.driverService.getDriverById(driverId);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });

      // The gate that makes a rating mean something. Without it any account could rate any driver
      // any number of stars, and the average shown next to a bid would be worthless.
      if (!(await this.hasRiddenWith(userId, driverId))) {
        return res.status(403).json({
          message: 'You can only review a driver after completing a ride with them',
        });
      }

      const existing = await this.reviewService.getReviewByUserForDriver(userId, driverId);
      const review = await this.reviewService.upsertReview({ userId, driverId, rating, comment });

      return res.status(existing ? 200 : 201).json({
        message: existing ? 'Review updated successfully.' : 'Review submitted successfully.',
        review,
      });
    } catch (error) {
      console.log(error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid review', error: error.message });
      }
      return res.status(500).json({ error: 'Failed to save review', message: 'Internal server error' });
    }
  };

  // True once this rider has completed at least one ride with this driver, in either product.
  // Two existence checks rather than one because the two ride types are separate collections by
  // design; both are index-covered on (assignedTo, rideStatus).
  hasRiddenWith = async (userId, driverId) => {
    const [quick, outstation] = await Promise.all([
      this.quickRideService.hasCompletedRideTogether(userId, driverId),
      this.outstationRideService.hasCompletedRideTogether(userId, driverId),
    ]);

    return Boolean(quick || outstation);
  };

  // GET /api/v3/reviews/driver/:driverId  (protected — either role)
  //
  // The driver's full public profile: rating, review count, and a page of reviews newest first.
  // This is the "see all" behind the ten that ride along on a bid.
  getDriverReviews = async (req, res) => {
    const { driverId } = req.params;

    if (!mongoose.isValidObjectId(driverId)) {
      return res.status(400).json({ message: 'driverId is not a valid id' });
    }

    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), DRIVER_REVIEW_MAX_PAGE_SIZE)
      : DRIVER_REVIEW_PAGE_SIZE;

    const requestedSkip = Number(req.query.skip);
    const skip = Number.isFinite(requestedSkip) ? Math.max(Math.trunc(requestedSkip), 0) : 0;

    try {
      const driver = await this.driverService.getDriverById(driverId);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });

      const [summary, reviews, vehicle] = await Promise.all([
        this.reviewService.getDriverSummary(driverId),
        this.reviewService.getReviewsForDriver(driverId, { limit, skip }),
        this.vehicleService.getVehicleByDriver(driverId),
      ]);

      return res.status(200).json({
        driver: {
          driverId: String(driver._id),
          name: driver.name,
          profileImageUrl: driver.profileImageUrl,
          vehicleImageUrl: vehicle?.vehicleImages?.[0] ?? '',
          averageRating: summary.averageRating,
          totalReviews: summary.totalReviews,
        },
        count: reviews.length,
        skip,
        limit,
        data: reviews,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch reviews', message: 'Internal server error' });
    }
  };

  // GET /api/v3/reviews/my  (protected — user only)
  // Every review this rider has written, so the app can show "you rated them 4★" on a driver.
  getMyReviews = async (req, res) => {
    try {
      const reviews = await this.reviewService.getReviewsByUser(req.user._id);
      return res.status(200).json({ count: reviews.length, data: reviews });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch reviews', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/reviews/:id  (protected — user only)
  deleteReview = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Review not found' });
    }

    try {
      // Ownership is in the delete predicate, so someone else's review reads as "not found"
      // rather than as a 403 that confirms it exists.
      const deleted = await this.reviewService.deleteReviewForUser(req.params.id, req.user._id);
      if (!deleted) return res.status(404).json({ message: 'Review not found' });

      return res.status(200).json({ message: 'Review deleted successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to delete review', message: 'Internal server error' });
    }
  };
}
