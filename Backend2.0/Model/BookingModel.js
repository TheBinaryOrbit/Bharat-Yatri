import mongoose from "mongoose";
import VehicleType from "../utils/VehicleType";

const BookingSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    required: true,
    trim: true,
    enum: VehicleType,
    uppercase : true
  },
  pickUpDate: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => value >= new Date(),
      message: "Pick-up date cannot be in the past"
    }
  },
  pickUpTime: {
    type: String,
    required: true,
    trim: true,
    match: [/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, "Invalid time format (e.g., 10:30 AM)"]
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
    ref: 'user'
  }

}, {
  timestamps: true
});


export const booking = mongoose.model('booking' , BookingSchema);