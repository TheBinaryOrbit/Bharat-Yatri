import express from 'express';
import { GetOtp, verifyOtp, handleAddAgent, handleAddRider, handleGetUser, handleUpdateUser } from '../Controller/UserController.js';
//admin router
import { getAllAgents , getAllRides ,  Verifyuser } from '../Controller/UserController.js';
import { handleUploadAadhar, handleUploadPan } from '../Controller/UploadPhoto.js';
import { uploadAadhar } from "../Storage/uploadAadhar.js"
import { uploaddl } from '../Storage/uploadPan.js';

export const userRouter = express.Router();


userRouter.post('/getotp', GetOtp);
userRouter.post('/verifyotp', verifyOtp);
userRouter.post('/addagent' , handleAddAgent);
userRouter.post('/addrider', handleAddRider);
userRouter.get('/getuser/:id' , handleGetUser);
userRouter.patch('/updateuser/:id' , handleUpdateUser)

userRouter.post('/uploadaadhar/:id' ,uploadAadhar.single('image') , handleUploadAadhar)
userRouter.post('/uploadpan/:id' , uploaddl.single('image'),handleUploadPan)
// admin user 

userRouter.get('/getallagent' , getAllAgents);
userRouter.get('/getallriders' , getAllRides);
userRouter.patch('/verifyuser/:id' , Verifyuser)


// upload-aadhar , upload-pancard , updatename , updateaddharnumber , updatedlnumber
// verifyuser by admin , getalluser by admin

