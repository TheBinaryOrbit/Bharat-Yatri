import express from 'express'
import { addDriver, deleteDriver, getDriverByUserId } from '../Controller/DriverController.js';

export const DriverRouter = express.Router();

DriverRouter.post('/add' , addDriver);
DriverRouter.delete('/delete/:id' , deleteDriver);
DriverRouter.get('/getmydrivers/:userId' , getDriverByUserId);
