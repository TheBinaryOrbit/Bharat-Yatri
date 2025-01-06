import express from 'express';
import { GetOtp , verifyOtp  , handleAddAgent , handleAddRider} from '../Controller/UserController.js';


export const userRouter = express.Router();

userRouter.post('/getotp' , GetOtp);
userRouter.post('/verifyotp' , verifyOtp);
userRouter.post('/addagent' , handleAddAgent);
userRouter.post('/addrider' , handleAddRider);


// upload-aadhar , upload-pancard , updatename , updateaddharnumber , updatedlnumber
// verifyuser by admin , getalluser by admin

