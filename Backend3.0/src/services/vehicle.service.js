import { Vehicle } from '../models/vehicle.model.js';

export class VehicleService {
  getAllVehicles = async () => {
    return Vehicle.find().populate('vehicleTypeId').populate('driverId', 'name phoneNumber');
  };

  getVehicleById = async (id) => {
    return Vehicle.findById(id).populate('vehicleTypeId').populate('driverId', 'name phoneNumber');
  };

  getVehiclesByDriver = async (driverId) => {
    return Vehicle.find({ driverId }).populate('vehicleTypeId');
  };

  getVehicleByNumber = async (vehicleNumber) => {
    return Vehicle.findOne({ vehicleNumber });
  };

  createVehicle = async (data) => {
    return Vehicle.create(data);
  };

  updateVehicle = async (id, data) => {
    return Vehicle.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  };

  deleteVehicle = async (id) => {
    return Vehicle.findByIdAndDelete(id);
  };
}
