import { Router } from 'express';
import { adminProtect, can } from '../../middlewares/adminAuth.js';
import { uploadAdminImage, uploadVehicleTypeIcon } from '../../middlewares/upload.js';
import { AdminAuthController } from '../../controllers/admin/adminAuth.controller.js';
import { AdminUsersController } from '../../controllers/admin/adminUsers.controller.js';
import { DashboardController } from '../../controllers/admin/dashboard.controller.js';
import { LiveController } from '../../controllers/admin/live.controller.js';
import { CustomersController } from '../../controllers/admin/customers.controller.js';
import { DriversController } from '../../controllers/admin/drivers.controller.js';
import { VehiclesController } from '../../controllers/admin/vehicles.controller.js';
import { RidesController } from '../../controllers/admin/rides.controller.js';
import { ContentController } from '../../controllers/admin/content.controller.js';
import { ReportsController } from '../../controllers/admin/reports.controller.js';
import { NotesController } from '../../controllers/admin/notes.controller.js';
import { InstallReferrerController } from '../../controllers/installReferrer.controller.js';

// Everything the admin portal calls, under /api/v3/admin. Each route carries its own permission;
// constants/admin.constants.js says which roles hold which.
const router = Router();

const auth = new AdminAuthController();
const admins = new AdminUsersController();
const dashboard = new DashboardController();
const live = new LiveController();
const customers = new CustomersController();
const drivers = new DriversController();
const vehicles = new VehiclesController();
const quickRides = new RidesController('quickride');
const outstationRides = new RidesController('outstation');
const content = new ContentController();
const reports = new ReportsController();
const notes = new NotesController();
const referrers = new InstallReferrerController();

// --- Session: login is public, everything after this is signed in ---
router.post('/auth/login', auth.login);
router.use(adminProtect);
router.get('/auth/me', auth.me);
router.patch('/auth/password', auth.changePassword);

// --- Overview ---
router.get('/dashboard/summary', can('dashboard.view'), dashboard.summary);
router.get('/dashboard/timeseries', can('dashboard.view'), dashboard.timeseries);
router.get('/badges', dashboard.badges);

router.get('/live/drivers', can('live.view'), live.drivers);
router.get('/live/rides', can('live.view'), live.rides);
router.get('/heatmap/supply', can('live.view'), live.supply);
router.get('/heatmap/demand', can('live.view'), live.demand);

// --- Rides (bids live inside the ride detail) ---
router.get('/quick-rides', can('rides.view'), quickRides.list);
router.get('/quick-rides/:id', can('rides.view'), quickRides.detail);
router.get('/outstation-rides', can('rides.view'), outstationRides.list);
router.get('/outstation-rides/:id', can('rides.view'), outstationRides.detail);

// --- People ---
router.get('/customers', can('people.view'), customers.list);
router.get('/customers/:id', can('people.view'), customers.detail);
router.patch('/customers/:id', can('people.edit'), customers.update);
router.patch('/customers/:id/block', can('people.block'), customers.block);

router.get('/drivers', can('people.view'), drivers.list);
router.get('/drivers/:id', can('people.view'), drivers.detail);
router.get('/drivers/:id/reviews', can('people.view'), drivers.reviews);
router.delete('/drivers/:id/reviews/:reviewId', can('reviews.moderate'), drivers.deleteReview);
router.get('/drivers/:id/bids', can('people.view'), drivers.bids);
router.patch('/drivers/:id/block', can('people.block'), drivers.block);

router.get('/kyc', can('kyc.review'), drivers.kycQueue);
router.get('/kyc/:id', can('kyc.review'), drivers.kycCaseDetail);
router.patch('/kyc/:id/review', can('kyc.review'), drivers.kycReview);

router.get('/vehicles', can('people.view'), vehicles.list);
router.get('/vehicles/:id', can('people.view'), vehicles.detail);

// --- Configuration ---
// Vehicle types are read by many screens (filters), so reading is broad; writing is pricing.edit.
router.get('/vehicle-types', vehicles.listTypes);
router.post('/vehicle-types', can('pricing.edit'), uploadVehicleTypeIcon, vehicles.createType);
router.post('/vehicle-types/fare-preview', can('pricing.edit'), vehicles.farePreview);
router.patch('/vehicle-types/:id', can('pricing.edit'), uploadVehicleTypeIcon, vehicles.updateType);

router.get('/app-content', can('content.edit'), content.listContent);
router.post('/app-content', can('content.edit'), content.createContent);
router.get('/app-content/:id', can('content.edit'), content.getContent);
router.patch('/app-content/:id', can('content.edit'), content.updateContent);
router.delete('/app-content/:id', can('content.edit'), content.deleteContent);

router.get('/settings', can('settings.edit'), content.listSettings);
router.patch('/settings/:type', can('settings.edit'), content.updateSettings);
router.post('/uploads/image', can('settings.edit', 'content.edit'), uploadAdminImage, content.uploadImage);

// --- Reports & acquisition ---
router.get('/reports/rides', can('reports.view'), reports.rides);
router.get('/reports/drivers', can('reports.view'), reports.drivers);
router.get('/reports/customers', can('reports.view'), reports.customers);
router.get('/reports/areas', can('reports.view'), reports.areas);

router.get('/install-referrers', can('referrers.view'), referrers.list);
router.get('/install-referrers/summary', can('referrers.view'), referrers.summary);
router.get('/install-referrers/timeseries', can('referrers.view'), reports.referrerTimeseries);

// --- Administration ---
router.get('/notes', can('people.view', 'rides.view'), notes.list);
router.post('/notes', can('notes.write'), notes.create);

router.get('/admins/roles', can('admins.manage'), admins.roles);
router.get('/admins', can('admins.manage'), admins.list);
router.post('/admins', can('admins.manage'), admins.create);
router.patch('/admins/:id', can('admins.manage'), admins.update);
router.get('/audit-logs', can('audit.view'), admins.auditLogs);

export default router;
