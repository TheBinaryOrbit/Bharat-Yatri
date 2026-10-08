import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import {
  uploadDriverOnboarding,
  uploadDriverDocs,
  uploadDriverPersonal,
  uploadDriverLicence,
  uploadVehicleDocs,
} from '../middlewares/upload.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const driverController = new DriverController();

router.get('/', driverController.getDrivers);

// Full onboarding — driver + their (only) vehicle in a single call
router.post('/onboard', protect, uploadDriverOnboarding, driverController.onboardDriver);

// Step-wise onboarding — each step is saved on its own, so a driver who quits half way resumes
// from GET /onboard/status instead of starting over.
router.get('/onboard/status', protect, authorize('driver'), driverController.getOnboardingStatus);
router.post('/onboard/personal', protect, authorize('driver'), uploadDriverPersonal, driverController.savePersonalDetails);
router.post('/onboard/licence', protect, authorize('driver'), uploadDriverLicence, driverController.saveLicenceDetails);
router.post('/onboard/vehicle', protect, authorize('driver'), uploadVehicleDocs, driverController.saveVehicleDetails);

// KYC — driver initiates with their token; Signzy posts back to the callback
router.post('/kyc/verify', driverController.verifyKyc);
router.post('/kyc/callback/:phonenumber', driverController.completeKyc);
router.get('/kyc/status/:phonenumber', driverController.checkKycStatus);
// '/me' must precede '/:id' so it isn't captured as an id
router.get('/me', protect, authorize('driver'), driverController.getMe);
router.patch('/me', protect, authorize('driver'), uploadDriverDocs, driverController.updateMe);
router.route('/:id').get(driverController.getDriverById);

export default router;
