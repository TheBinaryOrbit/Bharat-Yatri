import mongoose from "mongoose";
import VehicleType from "../utils/VehicleType.js";


const VehicleSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    required: true,
    trim: true,
    enum: VehicleType,
    uppercase : true
  },
  registrationNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    // match: [/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/, "Invalid registration number format"]
    // Example format: MH12AB1234
  },
  yearOfManufacture: {
    type: String,
    required: true,
    trim: true,
    // match: [/^\d{4}$/, "Enter a valid 4-digit year"],
    // validate: {
    //   validator: function (value) {
    //     const year = parseInt(value);
    //     const currentYear = new Date().getFullYear();
    //     return year >= 1980 && year <= currentYear;
    //   },
    //   message: "Year must be between 1980 and the current year"
    // }
  },
  insuranceImage: {
    type: String,
    // required: true,
    trim: true
  },
  insuranceExpDate: {
    type: Date,
    // required: true,
    // validate: {
    //   validator: function (value) {
    //     return value >= new Date();
    //   },
    //   message: "Insurance expiry date cannot be in the past"
    // }
  },
  vehicleImages: {
    type: [String],
    required: true,
    // validate: {
    //   validator: function (arr) {
    //     return arr.length > 0;
    //   },
    //   message: "At least one vehicle image is required"
    // }
  },
  rcImage: {
    type: String,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
});

export const Vehicle = mongoose.model('vehicle', VehicleSchema);
