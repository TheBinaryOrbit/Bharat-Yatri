import { Router } from 'express';
import { OutstationRideBidController } from '../controllers/outstationRideBid.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const outstationRideBidController = new OutstationRideBidController();

router.post('/', protect, authorize('driver'), outstationRideBidController.createBid);

// '/my' must precede '/:id' so it isn't captured as an id
router.get('/my', protect, authorize('driver'), outstationRideBidController.getMyBids);

router.patch('/:id/accept', protect, authorize('user'), outstationRideBidController.acceptBid);
router.delete('/:id/withdraw', protect, authorize('driver'), outstationRideBidController.withdrawBid);
router.delete('/:id', protect, authorize('user'), outstationRideBidController.rejectBid);

export default router;
