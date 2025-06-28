import express from 'express';
import { addUpiDetails, deleteUpiDetails, getUpiDetailsByUserId, updateUpiDetails } from '../Controller/UpiController.js';

export const UpiRouter = express.Router();

UpiRouter.post('/add' , addUpiDetails);
UpiRouter.put('/update/:userId' , updateUpiDetails);
UpiRouter.delete('/delete/:userId' , deleteUpiDetails);
UpiRouter.get('/get/:userId' , getUpiDetailsByUserId);