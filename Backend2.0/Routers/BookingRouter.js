import express from 'express'
import { addBooking, deleteBooking, findBookingById, getAllBookings, getBookingsByUser , getRecivedBookingsByUser, updateBookingAmount } from '../Controller/BookingController.js';
import { booking } from '../Model/BookingModel.js';

export const BookingRouter = express.Router();

BookingRouter.post('/add' , addBooking);
BookingRouter.delete('/delete/:id' , deleteBooking);
BookingRouter.get('/getmybooking/:userId' , getBookingsByUser);
BookingRouter.get('/getrecivedbooking/:userId' , getRecivedBookingsByUser);
BookingRouter.get('/get' , getAllBookings);

BookingRouter.get('/getbybookingId/:bookingId', findBookingById );
BookingRouter.patch('/updateamounts/:id', updateBookingAmount);