import mongoose from "mongoose";
import VehicleType from "../utils/VehicleType.js";

const BookingSchema = new mongoose.Schema({
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
    default : null
  },

  // status info 
  status : {
    type : String,
    enum : ['PENDING' , 'ASSIGNED' , 'PICKEDUP' , 'COMPLETED' , 'CANCELLED'],
    default : 'PENDING'
  }

}, {
  timestamps: true
});


export const booking = mongoose.model('booking', BookingSchema);