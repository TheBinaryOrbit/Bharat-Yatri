import express from 'express'
import { addBooking, deleteBooking, findBookingById, getAllBookings, getBookingsByUser , getRecivedBookingsByUser, updateBookingAmount , requestCommissionUpdate , updateBookingStatus , recivebooking, getAllBookingsAdmin, getBookingDetails, getLocationSuggestions } from '../Controller/BookingController.js';

export const BookingRouter = express.Router();

BookingRouter.post('/add' , addBooking);
BookingRouter.delete('/delete/:id' , deleteBooking);
BookingRouter.get('/getmybooking/:userId' , getBookingsByUser);
BookingRouter.get('/getrecivedbooking/:userId' , getRecivedBookingsByUser);
BookingRouter.get('/get' , getAllBookings);

BookingRouter.get('/getbybookingId/:bookingId', findBookingById );
BookingRouter.patch('/updateamounts/:id', updateBookingAmount);

BookingRouter.patch('/requestCommissionUpdate/:id', requestCommissionUpdate);
BookingRouter.patch('/updatestatus/:id', updateBookingStatus);
BookingRouter.patch('/recivebooking/:id',  recivebooking );

// Admin routes for booking management
BookingRouter.get('/admin/all', getAllBookingsAdmin);  // GET /api/booking/admin/all?status=All&page=1&limit=10
BookingRouter.get('/admin/details/:bookingId', getBookingDetails);  // GET /api/booking/admin/details/:bookingId

// Location suggestions route
BookingRouter.get('/location-suggestions', getLocationSuggestions);  // GET /api/v2/booking/location-suggestions?keyword=delhi