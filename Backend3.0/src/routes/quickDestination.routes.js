import { Router } from 'express';
import { QuickDestinationController } from '../controllers/quickDestination.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const quickDestinationController = new QuickDestinationController();

// Riders only, throughout — a driver has no saved destinations
router
  .route('/')
  .get(protect, authorize('user'), quickDestinationController.getMyDestinations)
  .post(protect, authorize('user'), quickDestinationController.createDestination);

// '/recent' must precede '/:id' so it isn't captured as an id.
// Not a saved shortcut: drop locations inferred from ride history, for the same search bar.
router.get('/recent', protect, authorize('user'), quickDestinationController.getRecentDestinations);

router
  .route('/:id')
  .get(protect, authorize('user'), quickDestinationController.getDestinationById)
  .patch(protect, authorize('user'), quickDestinationController.updateDestination)
  .delete(protect, authorize('user'), quickDestinationController.deleteDestination);

export default router;
