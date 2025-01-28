import express from 'express'
import { checkadmin } from '../Middleware/auth.js';
import { getAllAgents , getAllRides ,  Verifyuser } from '../Controller/AdminController/Admincontroller.js';


export const AdminRouter = express.Router();

AdminRouter.get('/getallagent' , checkadmin , getAllAgents);
AdminRouter.get('/getallriders' , checkadmin , getAllRides);
AdminRouter.patch('/verifyuser/:id' , checkadmin , Verifyuser)