import express from "express";
import { loginAdmin } from "../Controller/AdminController.js";


export const AdminRouter = express.Router();

AdminRouter.post('/login', loginAdmin);