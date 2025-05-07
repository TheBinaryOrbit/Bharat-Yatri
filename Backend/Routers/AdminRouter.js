import express from 'express'
import { checkadmin } from '../Middleware/auth.js';
import {  getAllUser,  handleGetUserByAdmin,  handleLogin,  Verifyuser , getstats, handleUpdatePhotoStatus } from '../Controller/AdminController/Admincontroller.js';


export const AdminRouter = express.Router();

AdminRouter.get('/getallusers' , checkadmin , getAllUser);
AdminRouter.get('/getspecificuser/:id' , checkadmin , handleGetUserByAdmin)
AdminRouter.patch('/verifyuser/:id' , checkadmin , Verifyuser);
AdminRouter.patch('/verifyphoto/:id' , checkadmin , handleUpdatePhotoStatus);
AdminRouter.post('/adminlogin' , handleLogin );
AdminRouter.get('/getstats' , checkadmin , getstats)