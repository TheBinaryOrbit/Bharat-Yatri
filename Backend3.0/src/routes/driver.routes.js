import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { uploadDriverOnboarding } from '../middlewares/upload.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const driverController = new DriverController();

router.get('/', driverController.getDrivers);

// Full onboarding — driver + first vehicle in a single call
router.post('/onboard', uploadDriverOnboarding, driverController.onboardDriver);

// KYC — driver initiates with their token; Signzy posts back to the callback
router.post('/kyc/verify', protect, authorize('driver'), driverController.verifyKyc);
router.post('/kyc/callback/:driverId', driverController.completeKyc);

// '/me' must precede '/:id' so it isn't captured as an id
router.get('/me', protect, authorize('driver'), driverController.getMe);
router.route('/:id').get(driverController.getDriverById);

export default router;
