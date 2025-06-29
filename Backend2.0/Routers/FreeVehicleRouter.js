import express from 'express';
import { addFreeVehicle, deleteFreeVehicle, getAvailableFreeRides, getFreeVehiclesByUser, markFreeVehicleAsCompleted } from '../Controller/FreeVehicleController.js';

export const FreeVehicleRouter = express.Router();

FreeVehicleRouter.post('/add' , addFreeVehicle);
FreeVehicleRouter.delete('/delete/:id' , deleteFreeVehicle);
FreeVehicleRouter.patch('/complete/:id' , markFreeVehicleAsCompleted);

FreeVehicleRouter.get('getmyfreerides/:userId' , getFreeVehiclesByUser);
FreeVehicleRouter.get('/get' , getAvailableFreeRides);