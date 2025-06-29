import express from 'express';
import { checkUser, createUser, GetOTP, getUserById, offUserAlerts, onUserAlerts, updateUser, verifyOTP } from '../Controller/UserController.js';

export const UserRouter = express.Router();

UserRouter.post('/getotp' , GetOTP);
UserRouter.post('/verifyotp' , verifyOTP);
UserRouter.post('/createaccount' , createUser);

UserRouter.patch('/update/:id' , updateUser);

UserRouter.get('/get/:id' , getUserById);

UserRouter.patch('/aleart/on/:id' , onUserAlerts );
UserRouter.patch('/aleart/off/:id' , offUserAlerts );


UserRouter.get('/checkuser/:id' , checkUser);