import mongoose from "mongoose";
import VehicleType from "../utils/VehicleType.js";

const FreeVehicleSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    required: true,
    trim: true,
    enum: VehicleType,
    uppercase : true
  },
  vehicleStartTime: {
    type: String,
    required: true,
    trim: true,
    match: [/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, "Invalid start time format (e.g., 09:00 AM)"]
  },
  vehicleEndTime: {
    type: String,
    required: true,
    trim: true,
    match: [/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, "Invalid end time format (e.g., 06:00 PM)"]
  },
  vehicleLocation: {
    type: String,
    required: true,
    trim: true,
    minlength: 3
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  isCompleted : {
    type : Boolean,
    required : true,
    default : false
  }
}, {
  timestamps: true
});


export const FreeVehicle = mongoose.model('freevehicle' , FreeVehicleSchema)