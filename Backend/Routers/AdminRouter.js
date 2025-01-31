import express from 'express'
import { checkadmin } from '../Middleware/auth.js';
import {  getAllUser,  handleGetUserByAdmin,  handleLogin,  Verifyuser , getstats } from '../Controller/AdminController/Admincontroller.js';


export const AdminRouter = express.Router();

AdminRouter.get('/getallusers' , checkadmin , getAllUser);
AdminRouter.get('/getspecificuser/:id' , checkadmin , handleGetUserByAdmin)
AdminRouter.patch('/verifyuser/:id' , checkadmin , Verifyuser);
AdminRouter.post('/adminlogin' , handleLogin );
AdminRouter.get('/getstats' , checkadmin , getstats)