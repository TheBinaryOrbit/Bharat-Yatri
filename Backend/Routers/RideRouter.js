import express from 'express';
import { addride ,  getAllrides , getOwnrides} from '../Controller/RideController.js';


export const rideRouter = express.Router();

rideRouter.post('/addride' , addride);
rideRouter.get('/getallrides' , getAllrides);
rideRouter.get('/getownrides/:id' , getOwnrides)
