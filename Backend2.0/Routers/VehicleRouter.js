import express from 'express';
import { addVehicle, deleteVehicle, getVehiclesByUserId , getVehicleByPhoneNumber } from '../Controller/VehicleController.js';

export const VehicleRouter = express.Router();

VehicleRouter.post('/add' , addVehicle);
VehicleRouter.delete('/delete/:id' , deleteVehicle);
VehicleRouter.get('/get/:userId' , getVehiclesByUserId);
VehicleRouter.get('/get/driver/:phone' , getVehicleByPhoneNumber);  