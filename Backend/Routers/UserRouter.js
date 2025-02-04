import express from 'express';
import { GetOtp, verifyOtp, handleAddAgent, handleAddRider, handleGetUser, handleUpdateUser } from '../Controller/UserConroller/UserController.js';

import { handleUploadAadhar, handleUploadPan } from '../Controller/UploadPhotoController/UploadPhoto.js';
import { uploadAadhar } from "../Storage/uploadAadhar.js"
import { uploaddl } from '../Storage/uploadPan.js';

export const userRouter = express.Router();


userRouter.post('/getotp', GetOtp);
userRouter.post('/verifyotp', verifyOtp);

userRouter.post('/addagent' , handleAddAgent);
userRouter.post('/addrider', handleAddRider);

userRouter.post('/uploadaadhar/:id' ,uploadAadhar.single('image') , handleUploadAadhar)
userRouter.post('/uploaddl/:id' , uploaddl.single('image'),handleUploadPan)


userRouter.get('/getuser/:id' , handleGetUser);
userRouter.patch('/updateuser/:id' , handleUpdateUser)


