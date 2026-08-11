import { Router } from 'express';
import { SettingController } from '../controllers/setting.controller.js';
import { adminAuth } from '../middlewares/admin.js';

const router = Router();
const settingController = new SettingController();

// Admin-only: the whole collection raw, and both writes.
router.get('/', adminAuth, settingController.getAll);
router.post('/', adminAuth, settingController.create);
router.patch('/:type', adminAuth, settingController.update);

// Public: an app reads its own platform's settings at boot, before anyone has logged in, which is
// exactly when the force-update gate has to fire. It stays open deliberately — adminAuth is a
// shared ADMIN_API_KEY, and a key shipped inside a mobile binary is a key that has leaked.
router.get('/:type', settingController.getByType);

export default router;
