import express from 'express'
import { addBankDetails, updateBankDetails } from '../Controller/BankDetailsController.js';

export const BankDetailsRouter = express.Router();

BankDetailsRouter.post('/addbankdetails' , addBankDetails);
BankDetailsRouter.patch('/update/:userId' , updateBankDetails);
BankDetailsRouter.delete('/delete/:userId' , updateBankDetails);
BankDetailsRouter.get('/get/:userId' , updateBankDetails);
