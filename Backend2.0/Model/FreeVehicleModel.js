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
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time format (e.g., 09:00, 23:45)"]
  },
  vehicleEndTime: {
    type: String,
    required: true,
    trim: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time format (e.g., 09:00, 23:45)"]
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