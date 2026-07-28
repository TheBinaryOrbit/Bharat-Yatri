import { Router } from 'express';
import { QuickRideBidController } from '../controllers/quickRideBid.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const quickRideBidController = new QuickRideBidController();

router.post('/', protect, authorize('driver'), quickRideBidController.createBid);

// '/my' must precede '/:id' so it isn't captured as an id
router.get('/my', protect, authorize('driver'), quickRideBidController.getMyBids);

router.patch('/:id/accept', protect, authorize('user'), quickRideBidController.acceptBid);
router.delete('/:id/withdraw', protect, authorize('driver'), quickRideBidController.withdrawBid);
router.delete('/:id', protect, authorize('user'), quickRideBidController.rejectBid);

export default router;
