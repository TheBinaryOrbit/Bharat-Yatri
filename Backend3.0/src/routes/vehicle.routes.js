import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller.js';
import { uploadVehicleDocs } from '../middlewares/upload.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const vehicleController = new VehicleController();

router
  .route('/')
  .get(vehicleController.getVehicles)
  .post(protect, authorize('driver'), uploadVehicleDocs, vehicleController.createVehicle);

// '/my' must precede '/:id' so it isn't captured as an id
router.get('/my', protect, authorize('driver'), vehicleController.getMyVehicles);
router.route('/:id').get(vehicleController.getVehicleById);

export default router;
