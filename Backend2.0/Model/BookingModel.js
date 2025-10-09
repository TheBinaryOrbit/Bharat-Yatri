import mongoose from "mongoose";
import VehicleType from "../utils/VehicleType.js";


const commissionSchema = new mongoose.Schema({
  bookingAmount: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d+(\.\d{1,2})?$/, 'Invalid booking amount format']
  },
  commissionAmount: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d+(\.\d{1,2})?$/, 'Invalid commission amount format']
  },
  requestedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
})

const BookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  vehicleType: {
    type: String,
    required: true,
    trim: true,
    enum: VehicleType,
    uppercase: true
  },
  pickUpDate: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => {
        const inputDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        return inputDate >= yesterday;
      },
      message: "Pick-up date must be today or one previous day only"
    }
  },
  pickUpTime: {
    type: String,
    required: true,
    trim: true,
    // match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time format (e.g., 09:00, 23:45)"]
  },
  pickUpLocation: {
    type: String,
    required: true,
    trim: true,
    minlength: 3
  },
  dropLocation: {
    type: String,
    required: true,
    trim: true,
    minlength: 3
  },
  bookingType: {
    type: String,
    required: true,
    enum: ['ONE-WAY', 'ROUND']
  },
  getBestQuotePrice: {
    type: Boolean,
    required: true,
    default: false
  },

  // Amounts (consider converting to Number if doing calculations)
  bookingAmount: {
    type: String,
    trim: true,
    match: [/^\d+(\.\d{1,2})?$/, 'Invalid amount format']
  },
  commissionAmount: {
    type: String,
    trim: true,
    match: [/^\d+(\.\d{1,2})?$/, 'Invalid amount format']
  },

  // Profile preferences
  isProfileHidden: {
    type: Boolean,
    required: true,
    default: false
  },
  extraRequirements: {
    type: [String],
    validate: {
      validator: (arr) => Array.isArray(arr),
      message: 'Extra requirements must be an array of strings'
    }
  },

  // User references
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  recivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null
  },
  status: {
    type: String,
    enum: ['PENDING', 'ASSIGNED', 'PICKEDUP', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  upiId: {
    type: String,
    trim: true,
    match: [/^\w+@\w+$/, 'Invalid UPI ID format']
  },
  paymentRequests: [
    {
      type: commissionSchema,
    }
  ],

  payeeUpiId: {
    type: String,
    trim: true,
    match: [/^\w+@\w+$/, 'Invalid UPI ID format']
  },

  isPaid: {
    type: Boolean,
    default: false
  },

  // Settlement/Payout tracking fields
  settlementStatus: {
    type: String,
    enum: ['unpaid', 'partiallypaid', 'fullpaid'],
    default: 'unpaid'
  },
  razorpayContactId: {
    type: String,
    trim: true
  },
  razorpayFundAccountId: {
    type: String,
    trim: true
  },
  razorpayPayoutId: {
    type: String,
    trim: true
  },
  payoutAmount: {
    type: String,
    trim: true,
    match: [/^\d+(\.\d{1,2})?$/, 'Invalid payout amount format']
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'queued', 'processing', 'processed', 'cancelled', 'failed'],
    default: 'pending'
  },
  payoutInitiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin'
  },
  payoutInitiatedAt: {
    type: Date
  },
}, {
  timestamps: true,
});

export const booking = mongoose.model('booking', BookingSchema);