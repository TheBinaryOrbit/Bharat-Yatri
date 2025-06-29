import express from 'express'
import { addBooking, deleteBooking, getAllBookings, getBookingsByUser } from '../Controller/BookingController.js';

export const BookingRouter = express.Router();

BookingRouter.post('/add' , addBooking);
BookingRouter.delete('/delete/:id' , deleteBooking);
BookingRouter.get('/getmybooking/:userId' , getBookingsByUser);
BookingRouter.get('/getbooking' , getAllBookings);