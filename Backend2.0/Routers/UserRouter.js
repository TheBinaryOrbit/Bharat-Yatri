import express from 'express';
import { checkUser, createUser, GetOTP, getUserById, offUserAlerts, onUserAlerts, updateUser, uploadUserPhoto, verifyOTP, getAllUsers, getUserDetails } from '../Controller/UserController.js';

export const UserRouter = express.Router();

UserRouter.post('/getotp' , GetOTP);
UserRouter.post('/verifyotp' , verifyOTP);
UserRouter.post('/createaccount' , createUser);

UserRouter.patch('/update/:id' , updateUser);

UserRouter.get('/get/:id' , getUserById);

UserRouter.patch('/aleart/on/:id' , onUserAlerts );
UserRouter.patch('/aleart/off/:id' , offUserAlerts );

UserRouter.get('/checkuser/:id' , checkUser);

UserRouter.post('/upload/:id', uploadUserPhoto);

// Admin routes for user management
UserRouter.get('/admin/all', getAllUsers);  // GET /api/user/admin/all?subscriptionStatus=all&page=1&limit=10
UserRouter.get('/admin/details/:userId', getUserDetails);  // GET /api/user/admin/details/:userId