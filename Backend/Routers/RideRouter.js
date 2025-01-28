import express from 'express';
import { addride ,  getAllrides , getOwnrides, hanldeDeleteRide, hanldeUpdateRide} from '../Controller/RideController/RideController.js';


export const rideRouter = express.Router();

rideRouter.post('/addride' , addride);
rideRouter.get('/getallrides' , getAllrides);
rideRouter.get('/getownrides/:id' , getOwnrides);
rideRouter.patch('/updateride/:id' , hanldeUpdateRide);
rideRouter.delete('/deleteride/:id' , hanldeDeleteRide);