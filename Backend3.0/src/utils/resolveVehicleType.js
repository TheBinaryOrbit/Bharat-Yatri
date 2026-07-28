import mongoose from 'mongoose';
import { VehicleType } from '../models/vehicleType.model.js';

// Accepts either a VehicleType ObjectId or its slug (e.g. "bharat_mini").
// Shared by the vehicle, driver and quick-ride controllers, which each used to carry a copy.
export const resolveVehicleType = async (vehicleTypeId) => {
  if (!vehicleTypeId) return null;

  if (mongoose.isValidObjectId(vehicleTypeId)) {
    return VehicleType.findById(vehicleTypeId);
  }
  return VehicleType.findOne({ slug: String(vehicleTypeId).toLowerCase() });
};
