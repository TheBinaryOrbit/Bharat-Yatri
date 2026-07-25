import { Router } from 'express';
import { AppContentController } from '../controllers/appContent.controller.js';
import { adminAuth } from '../middlewares/admin.js';

const router = Router();
const appContentController = new AppContentController();

// Admin-only writes
router.post('/', adminAuth, appContentController.create);
router.patch('/:id', adminAuth, appContentController.update);
router.delete('/:id', adminAuth, appContentController.remove);

// Public reads — app type (user|driver) is mandatory
router.get('/:type', appContentController.getByApp);
router.get('/:type/:idOrSlug', appContentController.getOne);

export default router;
