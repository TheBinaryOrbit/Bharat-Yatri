import { Router } from 'express';
import { InstallReferrerController } from '../controllers/installReferrer.controller.js';
import { protect } from '../middlewares/auth.js';
import { adminAuth } from '../middlewares/admin.js';

const router = Router();
const installReferrerController = new InstallReferrerController();

// Admin reads. Grouped so the access model of this file reads top to bottom: locked, locked,
// authenticated, open. If a GET '/:id' is ever added it must go BELOW '/summary', or it will
// swallow it.
router.get('/summary', adminAuth, installReferrerController.summary);
router.get('/', adminAuth, installReferrerController.list);

// Signup-time link. Auth'd, because it writes an account id onto an install row.
router.post('/link', protect, installReferrerController.link);

// The first-launch write. Public by necessity — it runs before any account exists.
router.post('/', installReferrerController.record);

export default router;
