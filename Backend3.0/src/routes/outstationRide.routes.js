import { Router } from 'express';
import { OutstationRideController } from '../controllers/outstationRide.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const outstationRideController = new OutstationRideController();

// Suggested fare per vehicle type for a trip, plus the bookable pickup window
router.post('/fare-estimate', protect, authorize('user'), outstationRideController.getFareEstimate);

router.post('/', protect, authorize('user'), outstationRideController.createRide);

// Literal paths must precede '/:id' so they aren't captured as an id
// Resume-on-open: one call that restores either app's screen
router.get('/live', protect, outstationRideController.getLiveRides);
router.get('/available', protect, authorize('driver'), outstationRideController.getAvailableRides);
router.get('/my', protect, outstationRideController.getMyRides);
// Public: the tracking token is itself the credential, and the response is redacted
router.get('/track/:token', outstationRideController.trackRide);

router.get('/:id', protect, outstationRideController.getRideById);
router.get('/:id/bids', protect, authorize('user'), outstationRideController.getRideBids);

router.patch('/:id/fare', protect, authorize('user'), outstationRideController.updateFare);
// Two driver steps, unlike QuickRide's one: /start is "I'm setting off" and opens the tracking
// window; /pickup takes the OTP, confirms the rider is aboard and shuts it again.
router.patch('/:id/start', protect, authorize('driver'), outstationRideController.startRide);
router.patch('/:id/pickup', protect, authorize('driver'), outstationRideController.pickupRide);
router.patch('/:id/complete', protect, authorize('driver'), outstationRideController.completeRide);
router.patch('/:id/cancel', protect, outstationRideController.cancelRide);

export default router;
