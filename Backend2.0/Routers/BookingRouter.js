import express from 'express'
import { addBooking, deleteBooking, getAllBookings, getBookingsByUser , getRecivedBookingsByUser } from '../Controller/BookingController.js';
import { booking } from '../Model/BookingModel.js';

export const BookingRouter = express.Router();

BookingRouter.post('/add' , addBooking);
BookingRouter.delete('/delete/:id' , deleteBooking);
BookingRouter.get('/getmybooking/:userId' , getBookingsByUser);
BookingRouter.get('/getrecivedbooking/:userId' , getRecivedBookingsByUser);
BookingRouter.get('/get' , getAllBookings);