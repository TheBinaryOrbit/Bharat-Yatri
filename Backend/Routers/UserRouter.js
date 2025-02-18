import express from 'express';
import { GetOtp, verifyOtp, handleAddAgent, handleAddRider, handleGetUser, handleUpdateUser } from '../Controller/UserConroller/UserController.js';

import { handleUploadAadhar, handleUploadNumberPlate, handleUploadPan, handleUploadPhoto } from '../Controller/UploadPhotoController/UploadPhoto.js';
import { uploadAadhar } from "../Storage/uploadAadhar.js"
import { uploaddl } from '../Storage/uploadDl.js';
import { uploadPhoto } from '../Storage/uploadPhoto.js';
import { uploadNumberPlate } from '../Storage/uploadNumberPlate.js';

export const userRouter = express.Router();


userRouter.post('/getotp', GetOtp);
userRouter.post('/verifyotp', verifyOtp);

userRouter.post('/addagent' , handleAddAgent);
userRouter.post('/addrider', handleAddRider);

userRouter.patch('/uploadaadhar/:id' ,uploadAadhar.single('image') , handleUploadAadhar);
userRouter.patch('/uploaddl/:id' , uploaddl.single('image'),handleUploadPan);
userRouter.patch('/uploadphoto/:id' , uploadPhoto.single('image'),handleUploadPhoto);
userRouter.patch('/uploadnumberplate/:id' , uploadNumberPlate.single('image'),handleUploadNumberPlate);


userRouter.get('/getuser/:id' , handleGetUser);
userRouter.patch('/updateuser/:id' , handleUpdateUser)


