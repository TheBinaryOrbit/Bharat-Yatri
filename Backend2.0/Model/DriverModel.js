import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[6-9]\d{9}$/, "Please enter a valid Indian phone number"],
  },
  address: {
    type: String,
    required: true,
    trim: true,
    minlength: 5
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  driverImage: {
    type: String,
    required: true,
  },
  dlNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    // match: [/^[A-Z]{2}\d{13}$/, "Enter a valid Driving License number"]
    // Common DL format: 2 letters + 13 digits (can be customized)
  },
  dlFront: {
    type: String,
    required: true,
  },
  dlBack: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true // optional: adds createdAt and updatedAt
});


export const Driver =  mongoose.model("Driver", DriverSchema);
