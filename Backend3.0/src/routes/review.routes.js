import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const reviewController = new ReviewController();

// One write endpoint for both cases: a rider holds a single review per driver, so posting again
// edits it. There is no PATCH.
router.post('/', protect, authorize('user'), reviewController.createReview);

// Literal paths must precede '/:id' so they aren't captured as an id
router.get('/my', protect, authorize('user'), reviewController.getMyReviews);
// Either role — a driver reads this to see their own rating
router.get('/driver/:driverId', protect, reviewController.getDriverReviews);

router.delete('/:id', protect, authorize('user'), reviewController.deleteReview);

export default router;
