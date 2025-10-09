import express from "express";
import { loginAdmin, processBookingPayout, checkPayoutStatus } from "../Controller/AdminController.js";


export const AdminRouter = express.Router();

AdminRouter.post('/login', loginAdmin);

// Payout management routes
AdminRouter.post('/payout/process', processBookingPayout);  // POST /api/v2/admin/payout/process
AdminRouter.get('/payout/status/:bookingId', checkPayoutStatus);  // GET /api/v2/admin/payout/status/:bookingId