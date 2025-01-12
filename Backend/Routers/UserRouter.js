import express from 'express';
import { GetOtp, verifyOtp, handleAddAgent, handleAddRider, handleGetUser, handleUpdateUser } from '../Controller/UserController.js';
//admin router
import { getAllAgents , getAllRides ,  Verifyuser } from '../Controller/UserController.js';

export const userRouter = express.Router();


userRouter.post('/getotp', GetOtp);
userRouter.post('/verifyotp', verifyOtp);
userRouter.post('/addagent' , handleAddAgent);
userRouter.post('/addrider', handleAddRider);
userRouter.get('/getuser/:id' , handleGetUser);
userRouter.patch('/updateuser/:id' , handleUpdateUser)


// admin user 

userRouter.get('/getallagent' , getAllAgents);
userRouter.get('/getallriders' , getAllRides);
userRouter.patch('/verifyuser/:id' , Verifyuser)


// upload-aadhar , upload-pancard , updatename , updateaddharnumber , updatedlnumber
// verifyuser by admin , getalluser by admin

