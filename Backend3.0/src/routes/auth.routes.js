import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();
const authController = new AuthController();

router.post('/otp', authController.getOTP);
router.post('/verify', authController.verifyOTP);

export default router;
