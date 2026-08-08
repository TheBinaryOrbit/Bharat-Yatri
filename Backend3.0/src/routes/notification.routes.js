import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
const notificationController = new NotificationController();

// No authorize() on any of these: a device belongs to whichever identity is holding the token,
// and both riders and drivers register one the same way.
router.patch('/token', protect, notificationController.registerToken);
router.delete('/token', protect, notificationController.clearToken);

// Non-production only; the controller enforces that, not the router, so the 404 is uniform.
router.post('/test', protect, notificationController.sendTest);

export default router;
