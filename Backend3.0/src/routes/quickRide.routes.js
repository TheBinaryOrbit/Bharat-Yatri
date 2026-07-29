import { Router } from 'express';
import { QuickRideController } from '../controllers/quickRide.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const quickRideController = new QuickRideController();

// Suggested fare per vehicle type for a trip, before any ride exists
router.post('/fare-estimate', protect, authorize('user'), quickRideController.getFareEstimate);

router.post('/', protect, authorize('user'), quickRideController.createRide);

// Literal paths must precede '/:id' so they aren't captured as an id
// Resume-on-open: one call that restores either app's screen
router.get('/live', protect, quickRideController.getLiveRides);
router.get('/available', protect, authorize('driver'), quickRideController.getAvailableRides);
router.get('/my', protect, quickRideController.getMyRides);
// Public: the tracking token is itself the credential, and the response is redacted
router.get('/track/:token', quickRideController.trackRide);

router.get('/:id', protect, quickRideController.getRideById);
router.get('/:id/bids', protect, authorize('user'), quickRideController.getRideBids);

router.patch('/:id/fare', protect, authorize('user'), quickRideController.updateFare);
router.patch('/:id/start', protect, authorize('driver'), quickRideController.startRide);
router.patch('/:id/complete', protect, authorize('driver'), quickRideController.completeRide);
router.patch('/:id/cancel', protect, quickRideController.cancelRide);

export default router;
