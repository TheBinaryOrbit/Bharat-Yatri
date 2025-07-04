import { booking } from "../Model/BookingModel.js";
import { sendnotification } from "../Notification/notification.js";

export const addBooking = async (req, res) => {
    try {

        const {
            vehicleType,
            pickUpDate,
            pickUpTime,
            pickUpLocation,
            dropLocation,
            bookingType,
            getBestQuotePrice,
            bookingAmount,
            commissionAmount,
            isProfileHidden,
            extraRequirements,
            bookedBy
        } = req.body;

        if (
            !vehicleType || !pickUpDate || !pickUpTime || !pickUpLocation ||
            !dropLocation || !bookingType || bookedBy === undefined
        ) {
            return res.status(400).json({ error: "All required fields must be provided." });
        }

        const data = {
            vehicleType,
            pickUpDate,
            pickUpTime,
            pickUpLocation,
            dropLocation,
            bookingType,
            bookedBy,
            extraRequirements,
        }

        if(getBestQuotePrice == true){
            data.getBestQuotePrice = true
        }
        else {
            data.bookingAmount = bookingAmount
            data.commissionAmount = commissionAmount
        }

        if(isProfileHidden){
            data.isProfileHidden = isProfileHidden
        }

        if(extraRequirements){
            data.extraRequirements = String(extraRequirements).split(',')
        }


        const newBooking = await booking.create(data);

        sendnotification(vehicleType, newBooking, bookedBy);

        return res.status(201).json({
            message: "Booking created successfully.",
            booking: newBooking
        });
    } catch (error) {
        console.error("Add Booking Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await booking.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.status(200).json({ message: "Booking deleted successfully." });
  } catch (error) {
    console.error("Delete Booking Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getBookingsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await booking.find({ bookedBy: userId }).populate('bookedBy', 'name phoneNumber email _id');

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Get Bookings by User Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getRecivedBookingsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await booking.find({ recivedBy: userId }).populate('bookedBy', 'name phoneNumber email _id') ;

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ error: "No bookings found for this user." });
    }


    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Get Bookings by User Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await booking.find({
      status : 'PENDING',
      recivedBy : null
    }).sort({ createdAt: -1 }).populate('bookedBy' ,'name phoneNumber email _id');


    return res.status(200).json({
      message: "Unassigned and incomplete bookings fetched.",
      bookings
    });
  } catch (error) {
    console.error("Fetch Unassigned Incomplete Bookings Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

