import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import driverRoutes from './driver.routes.js';
import vehicleTypeRoutes from './vehicleType.routes.js';
import vehicleRoutes from './vehicle.routes.js';
import paymentDetailsRoutes from './paymentDetails.routes.js';
import appContentRoutes from './appContent.routes.js';
import quickRideRoutes from './quickRide.routes.js';
import quickRideBidRoutes from './quickRideBid.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/drivers', driverRoutes);
router.use('/vehicle-types', vehicleTypeRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/payment-details', paymentDetailsRoutes);
router.use('/app-content', appContentRoutes);
router.use('/quick-rides', quickRideRoutes);
router.use('/quick-ride-bids', quickRideBidRoutes);

export default router;
