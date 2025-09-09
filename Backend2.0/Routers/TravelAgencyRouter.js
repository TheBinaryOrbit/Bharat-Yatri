import express from 'express';
import { createTravelAgency, getAllTravelAgencies, updateTravelAgency, findTravelAgencyById, findTravelAgencyByUserId, upsertTravelAgency } from '../Controller/TravelAgencyController.js';

const router = express.Router();

router.post('/', createTravelAgency);
router.get('/', getAllTravelAgencies);
router.put('/:id', updateTravelAgency);
router.get('/:id', findTravelAgencyById);  // <--- this route needed
router.get('/user/:userId', findTravelAgencyByUserId);
// router.post('/', upsertTravelAgency);

export default router;
