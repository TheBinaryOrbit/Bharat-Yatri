import { booking } from "../Model/BookingModel.js";
import { sendnotification } from "../Notification/notification.js";
import { generateShortBookingId } from '../utils/BookingIdGenerator.js';

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

    // Generate unique booking ID and ensure it's not duplicated (optional: loop + check DB)
    let bookingId = generateShortBookingId(6);

    // Optional: ensure uniqueness (loop until unique — not required for most use cases)
    while (await booking.findOne({ bookingId })) {
      bookingId = generateShortBookingId(6);
    }

    const data = {
      bookingId,
      vehicleType,
      pickUpDate,
      pickUpTime,
      pickUpLocation,
      dropLocation,
      bookingType,
      bookedBy,
      extraRequirements: extraRequirements ? String(extraRequirements).split(',') : [],
    };

    if (getBestQuotePrice === true) {
      data.getBestQuotePrice = true;
    } else {
      data.bookingAmount = bookingAmount;
      data.commissionAmount = commissionAmount;
    }

    if (isProfileHidden) {
      data.isProfileHidden = isProfileHidden;
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

    const bookings = await booking.find({ recivedBy: userId }).populate('bookedBy', 'name phoneNumber email _id');

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
      status: 'PENDING',
      recivedBy: null
    }).sort({ createdAt: -1 }).populate('bookedBy', 'name phoneNumber email _id');

    return res.status(200).json({
      message: "Unassigned and incomplete bookings fetched.",
      bookings
    });
  } catch (error) {
    console.error("Fetch Unassigned Incomplete Bookings Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// controller to update amount and commission of booking
export const updateBookingAmount = async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingAmount, commissionAmount } = req.body;

    const updatedBooking = await booking.findByIdAndUpdate(id, {
      bookingAmount,
      commissionAmount
    }, { new: true });

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.status(200).json({
      message: "Booking amounts updated successfully.",
      booking: updatedBooking
    });
  } catch (error) {
    console.error("Update Booking Amount Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });

  }
}

// controoler to find booking by bookingId
export const findBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    console.log("Received bookingId:", bookingId);

    if (!bookingId || bookingId.length < 4) {
      return res.status(400).json({ error: "Invalid booking ID." });
    }

    const bookingDetails = await booking.findOne({ bookingId }).populate('bookedBy', 'name phoneNumber email _id');

    if (!bookingDetails) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.status(200).json({
      message: "Booking details fetched successfully.",
      booking: bookingDetails
    });
  } catch (error) {
    console.error("Find Booking by ID Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

