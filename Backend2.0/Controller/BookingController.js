import { booking } from "../Model/BookingModel.js";
import { sendnotification } from "../Notification/notification.js";
import { generateShortBookingId } from '../utils/BookingIdGenerator.js';
import Razorpay from "razorpay";
import crypto from 'crypto';
import { sendStatusNotification } from "../Notification/StatusNotification.js";
import { generalNotification } from "../Notification/GeneralNotification.js";
import { User } from "../Model/UserModel.js";
import { Message } from '../Model/MessageModel.js'

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
      .populate('recivedBy', 'name phoneNumber email _id');

    const ORDER = ['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'];

    // Sort by status first, then by pickUpDate (latest first)
    bookings.sort((a, b) => {
      const statusDiff = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.pickUpDate) - new Date(a.pickUpDate); // -1 for descending
    });

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

    const ORDER = ['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'];

    // Sort by status first, then by pickUpDate (latest first)
    bookings.sort((a, b) => {
      const statusDiff = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.pickUpDate) - new Date(a.pickUpDate); // -1 for descending
    });

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ error: "No bookings found for this user." });
    }

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Get Recived Bookings by User Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    // const bookings = await booking.find({
    //   status: 'PENDING',
    //   recivedBy: null,
    // }).sort({ createdAt: -1 }).populate('bookedBy', 'name phoneNumber email _id');

    // get all the rides
    let bookings = await booking.find({
      status: { $ne: 'CANCELLED' }
    }, {
      _id: 1,
      bookingId: 1,
      vehicleType: 1,
      pickUpDate: 1,
      pickUpTime: 1,
      pickUpLocation: 1,
      dropLocation: 1,
      bookingType: 1,
      getBestQuotePrice: 1,
      isProfileHidden: 1,
      extraRequirements: 1,
      bookedBy: 1,
      status: 1,
      isPaid: 1,
      bookingAmount: 1,
      commissionAmount: 1,
      upiId: 1,
    }).sort({ createdAt: -1 }).populate('bookedBy', 'name phoneNumber email _id');

    const date = new Date();

    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const completedBookings = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'ASSIGNED' && b.status !== 'CANCELLED');

    bookings = bookings.filter(b => {
      const pickupDate = new Date(b.pickUpDate);
      pickupDate.setHours(0, 0, 0, 0); // reset to date only

      return (
        pickupDate >= today &&
        b.bookedBy != null
      );
    });

    const ORDER = ['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'];
    bookings.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));


    return res.status(200).json({
      message: "Unassigned and incomplete bookings fetched.",
      bookings: [...bookings, ...completedBookings]
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
    }, { status }, { new: true }).populate('bookedBy', 'name phoneNumber email _id fcmToken')
      .populate('recivedBy', 'name phoneNumber email _id fcmToken');


    console.log("Updated booking details:", updatedBooking);

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found." });
    }


    sendStatusNotification([updatedBooking.bookedBy.fcmToken, updatedBooking.recivedBy.fcmToken], updatedBooking.bookingId, status);
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
    const bookingDetails = await booking.findOne({ bookingId: id })
      .populate('bookedBy', 'name phoneNumber email _id fcmToken');

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


    await Message.create({
      sender: bookingDetails.bookedBy._id,
      receiver: recivedUserId,
      content: 'Payment Initiated👍',
      bookingId: bookingDetails.bookingId,
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
    ).populate('bookedBy', 'name phoneNumber email _id fcmToken')
      .populate('recivedBy', 'name phoneNumber email _id fcmToken');

    if (!bookingDetails) {
      return res.status(404).json({ error: "Booking not found." });
    }

    generalNotification({
      userarray: [bookingDetails.bookedBy.fcmToken],
      title: "Payment Completed",
      body: `Your payment for booking ID: ${bookingDetails.bookingId} has been completed successfully.`
    });

    await Message.create({
      sender: recivedBy,
      receiver: bookingDetails.bookedBy._id,
      content: 'Payment Completed✅',
      bookingId: bookingDetails.bookingId,
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

// Get All Bookings - Admin endpoint with status filter
export const getAllBookingsAdmin = async (req, res) => {
  try {
    const { status = 'All', page = 1, limit = 10 } = req.query;
    
    // Define allowed statuses
    const allowedStatuses = ['All', 'PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        error: "Invalid status. Allowed values: All, PENDING, ASSIGNED, PICKEDUP, COMPLETED, CANCELLED" 
      });
    }

    // Build filter based on status
    let filter = {};
    if (status !== 'All') {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    // Get bookings with minimal details for listing
    const bookings = await booking.find(filter)
      .select('bookingId vehicleType pickUpDate pickUpTime pickUpLocation dropLocation bookingType status bookingAmount bookedBy recivedBy createdAt')
      .populate('bookedBy', 'name phoneNumber city userType')
      .populate('recivedBy', 'name phoneNumber city userType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalBookings = await booking.countDocuments(filter);
    const totalPages = Math.ceil(totalBookings / limit);

    // Get status counts for dashboard
    const statusCounts = await booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusSummary = {
      PENDING: 0,
      ASSIGNED: 0,
      PICKEDUP: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };

    statusCounts.forEach(item => {
      statusSummary[item._id] = item.count;
    });

    return res.status(200).json({
      message: "Bookings retrieved successfully.",
      bookings,
      statusSummary,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalBookings,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Get All Bookings Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Specific Booking Details - Admin endpoint
export const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required." });
    }

    // Get booking with all details and populate user info
    const bookingDetails = await booking.findOne({ bookingId })
      .populate('bookedBy', 'name phoneNumber email city userType aadharNumber drivingLicenceNumber userImage isSubscribed isUserVerified')
      .populate('recivedBy', 'name phoneNumber email city userType aadharNumber drivingLicenceNumber userImage')
      .populate('paymentRequests.requestedTo', 'name phoneNumber city userType')
      .lean();

    if (!bookingDetails) {
      return res.status(404).json({ error: "Booking not found." });
    }

    // Get related messages for this booking
    const messages = await Message.find({
      $or: [
        { sender: bookingDetails.bookedBy._id },
        { receiver: bookingDetails.bookedBy._id },
        ...(bookingDetails.recivedBy ? [
          { sender: bookingDetails.recivedBy._id },
          { receiver: bookingDetails.recivedBy._id }
        ] : [])
      ]
    })
    .populate('sender', 'name phoneNumber')
    .populate('receiver', 'name phoneNumber')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    bookingDetails.recentMessages = messages;

    return res.status(200).json({
      message: "Booking details retrieved successfully.",
      booking: bookingDetails
    });
  } catch (error) {
    console.error("Get Booking Details Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Location Suggestions - Google Places API
export const getLocationSuggestions = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.trim().length < 2) {
      return res.status(400).json({ 
        error: "Keyword is required and must be at least 2 characters long." 
      });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Google Places API key not configured." 
      });
    }

    // Google Places Autocomplete API URL
    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(keyword)}&key=${apiKey}&types=geocode&components=country:in`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === 'OK') {
      const suggestions = data.predictions.map(prediction => ({
        place_id: prediction.place_id,
        description: prediction.description,
        main_text: prediction.structured_formatting?.main_text || '',
        secondary_text: prediction.structured_formatting?.secondary_text || '',
        types: prediction.types
      }));

      return res.status(200).json({
        message: "Location suggestions retrieved successfully.",
        suggestions
      });
    } else if (data.status === 'ZERO_RESULTS') {
      return res.status(200).json({
        message: "No location suggestions found.",
        suggestions: []
      });
    } else {
      console.error("Google Places API Error:", data);
      return res.status(500).json({ 
        error: "Failed to fetch location suggestions." 
      });
    }

  } catch (error) {
    console.error("Get Location Suggestions Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
