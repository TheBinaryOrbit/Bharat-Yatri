import { Router } from 'express';
import { PaymentDetailsController } from '../controllers/paymentDetails.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const paymentDetailsController = new PaymentDetailsController();

router.post('/', protect, authorize('driver'), paymentDetailsController.addPaymentDetails);
router.get('/my', protect, authorize('driver'), paymentDetailsController.getMyPaymentDetails);

export default router;
