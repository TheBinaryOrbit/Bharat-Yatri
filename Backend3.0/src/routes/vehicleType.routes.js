import { Router } from 'express';
import { VehicleTypeController } from '../controllers/vehicleType.controller.js';
import { uploadVehicleTypeIcon } from '../middlewares/upload.js';
import { adminAuth } from '../middlewares/admin.js';

const router = Router();
const vehicleTypeController = new VehicleTypeController();

router
  .route('/')
  .get(vehicleTypeController.getVehicleTypes)
  .post(adminAuth, uploadVehicleTypeIcon, vehicleTypeController.createVehicleType);

router.route('/:id').get(vehicleTypeController.getVehicleTypeById);

export default router;
