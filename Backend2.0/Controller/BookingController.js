import { booking } from "../Model/BookingModel.js";
import { sendnotification } from "../Notification/notification.js";
import { generateShortBookingId } from '../utils/BookingIdGenerator.js';
import Razorpay from "razorpay";
import { User } from "../Model/UserModel.js";
import { users } from "../Socket/chatSocket.js";
import { getSocket } from "../Socket/chatSocket.js";
import { Message } from "../Model/MessageModel.js";

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

// update booking status
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    const updatedBooking = await booking.findByIdAndUpdate(id, { status }, { new: true });

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found." });
    }

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
    const { recivedUserId, upiId } = req.body;

    const bookingDetails = await booking.findById(id);

    if (!bookingDetails.commissionAmount || !bookingDetails.bookingAmount) {
      return res.status(404).json({ error: "Booking should have updated the commission and booking amounts." });
    }




    const receiver = await User.findById(recivedUserId).select("name email");

    const paymentDetails = await razorpay.paymentLink.create({
      amount: bookingDetails.commissionAmount * 100, // in paise,
      currency: "INR",
      description: `Commission for Ride #${bookingDetails.bookingId}`,
      customer: {
        name: receiver.name,
        email: receiver.email
      }
    });

    const message = await Message.create({
      bookingId: id,
      sender: bookingDetails.bookedBy,
      receiver: recivedUserId,
      content: paymentDetails.short_url,
      delivered: false,
    });

    const latestChatItem = {
      senderId: message.sender,
      message: message.content,
      timestamp: message.timestamp,
      bookingId: message.bookingId,
      sender: {
        _id: receiver._id,
        name: receiver.name,
        email: receiver.email
      }
    };

    const io = getSocket();
    if (io) {
      const receiverSocket = users[recivedUserId];
      io.to(receiverSocket).emit("new_message", {
        _id: message._id,
        sender: message.sender,
        receiver: message.receiver,
        content: message.content,
        images: message.images,
        bookingId: message.bookingId,
        delivered: true,
        timestamp: message.timestamp
      });

      io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);
    }


    await booking.findByIdAndUpdate(id, {
      upiId: upiId,
      paymentLinkId: paymentDetails.id,
      paymentRequestedTo: recivedUserId
    }, { new: true });

    console.log("Payment Link Created:", paymentDetails);

    return res.status(200).json({
      message: "Commission request created successfully.",
      paymentLink: paymentDetails.short_url,
      latestChatItem : latestChatItem
    });
  } catch (error) {
    console.error("Request Commission Update Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}



export const recivebooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { recivedBy } = req.body;

    if (!recivedBy) {
      return res.status(400).json({ error: "Receiver ID is required." });
    }
    const bookingDetails = await booking.findById(id);

    if (bookingDetails.paymentRequestedTo.toString() !== recivedBy) {
      return res.status(400).json({ error: "This booking is not assigned to you." });
    }

    const paymentDetails = await razorpay.paymentLink.fetch(bookingDetails.paymentLinkId);

    if (paymentDetails.status !== 'paid') {
      return res.status(400).json({ error: "Payment not completed for this booking." });
    }

    const updatedBooking = await booking.findByIdAndUpdate(id, { recivedBy , status : 'ASSIGNED' }, { new: true });

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.status(200).json({
      message: "Booking assigned successfully.",
      booking: updatedBooking
    });
  } catch (error) {
    console.error("Assign Ride Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
