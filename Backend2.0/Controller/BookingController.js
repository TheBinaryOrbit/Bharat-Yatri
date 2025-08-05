import { booking } from "../Model/BookingModel.js";
import { sendnotification } from "../Notification/notification.js";
import { generateShortBookingId } from '../utils/BookingIdGenerator.js';
import Razorpay from "razorpay";
import crypto from 'crypto';
import { sendStatusNotification } from "../Notification/StatusNotification.js";
import { generalNotification } from "../Notification/GeneralNotification.js";
import { User } from "../Model/UserModel.js";
// razorypay payment integration
const razorpay = new Razorpay({
  key_id: process.env.key_id,
  key_secret: process.env.key_secret,
});

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

    const bookings = await booking.find({ bookedBy: userId })
      .populate('bookedBy', 'name phoneNumber email _id')
      .populate('recivedBy', 'name phoneNumber email _id'); // This will handle null automatically


    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Get Bookings by User Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getRecivedBookingsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await booking.find({ recivedBy: userId })
    .populate('bookedBy', 'name phoneNumber email _id')
    .populate('recivedBy', 'name phoneNumber email _id');

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

// update booking status
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;


    console.log("Received booking ID to update status:", id);
    console.log("Received new status:", status);

    if (!status || !['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    const updatedBooking = await booking.findOneAndUpdate({
      bookingId: id
    }, { status }, { new: true }). populate('bookedBy', 'name phoneNumber email _id fcmToken')
    .populate('recivedBy', 'name phoneNumber email _id fcmToken');


    console.log("Updated booking details:", updatedBooking);

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found." });
    }


    sendStatusNotification([updatedBooking.bookedBy.fcmToken , updatedBooking.recivedBy.fcmToken], updatedBooking.bookingId, status);
    return res.status(200).json({
      message: "Booking status updated successfully.",
      booking: updatedBooking
    });
  } catch (error) {
    console.error("Update Booking Status Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// request commission to update booking amount
export const requestCommissionUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    let { bookingAmount, commissionAmount, recivedUserId, upiId } = req.body;

    console.log("Received booking ID:", id);

    if (!recivedUserId || !upiId) {
      return res.status(400).json({ error: "Receiver user ID and UPI ID are required." });
    }

    // Fetch booking
    const bookingDetails = await booking.findOne({ bookingId: id });

    if (!bookingDetails) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (bookingDetails.getBestQuotePrice == true && (!bookingAmount || !commissionAmount)) {
      return res.status(400).json({ error: "Booking amount and commission amount are required." });
    } else {
      bookingAmount = bookingDetails.bookingAmount;
      commissionAmount = bookingDetails.commissionAmount;
    }

    // Check for duplicate commission request
    const alreadyExists = bookingDetails.paymentRequests.some(
      (req) =>
        req.requestedTo.toString() === recivedUserId
    );

    if (alreadyExists) {
      return res.status(409).json({ error: "Commission request already exists." });
    }

    const updatedBooking = await booking.findByIdAndUpdate(
      bookingDetails._id,
      {
        $push: {
          paymentRequests: {
            bookingAmount,
            commissionAmount,
            requestedTo: recivedUserId,
          },
        },
        $set: {
          upiId: upiId,
        },
      },
      {
        new: true, // return updated doc
      }
    );

    const reciver = await User.findById(recivedUserId).select("fcmToken");

    generalNotification({
      userarray: [reciver.fcmToken],
      title: "Commission Update Request",
      body: `A Commission update request has been made for booking ID: ${updatedBooking.bookingId}.`
    });


    return res.status(200).json({
      message: "Commission update requested successfully.",
      booking: bookingDetails
    });

  } catch (error) {
    console.error("Request Commission Update Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const recivebooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { recivedBy, razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;

    if (!recivedBy || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Receiver user ID and Razorpay details are required." });
    }

    // verify Razorpay payment signature
    const secret = process.env.key_secret;
    const generatedSignature = crypto.createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature." });
    }

    const bookingDetails = await booking.findOneAndUpdate(
      { bookingId: id },
      {
        $set: {
          status: "ASSIGNED",
          recivedBy,
          isPaid: true,
        },
      },
      { new: true }
    ). populate('bookedBy', 'name phoneNumber email _id fcmToken')
    .populate('recivedBy', 'name phoneNumber email _id fcmToken');

    if (!bookingDetails) {
      return res.status(404).json({ error: "Booking not found." });
    }

    generalNotification({
      userarray: [bookingDetails.bookedBy.fcmToken],
      title: "Payment Completed",
      body: `Your payment for booking ID: ${bookingDetails.bookingId} has been completed successfully.`
    });


    return res.status(200).json({
      message: "Booking received successfully.",
      booking: bookingDetails
    });

  } catch (error) {
    console.error("Receive Booking Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
