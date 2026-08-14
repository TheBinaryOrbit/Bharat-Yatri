import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { uploadUserProfile } from '../middlewares/upload.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();
const userController = new UserController();

router
  .route('/')
  .get(userController.getUsers)
  .post(uploadUserProfile, userController.createUser);

// '/me' must precede '/:id' so it isn't captured as an id
router.get('/me', protect, authorize('user'), userController.getMe);

// SOS contact — separate get / update / delete on the caller's own record
router.get('/me/sos-contact', protect, authorize('user'), userController.getSosContact);
router.put('/me/sos-contact', protect, authorize('user'), userController.updateSosContact);
router.delete('/me/sos-contact', protect, authorize('user'), userController.deleteSosContact);

router.route('/:id').get(userController.getUserById);

export default router;
