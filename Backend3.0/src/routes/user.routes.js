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
router.route('/:id').get(userController.getUserById);

export default router;
