import { VehicleType } from '../models/vehicleType.model.js';

export class VehicleTypeService {
  getAllVehicleTypes = async (filter = {}) => {
    return VehicleType.find(filter);
  };

  getVehicleTypeById = async (id) => {
    return VehicleType.findById(id);
  };

  getVehicleTypeBySlug = async (slug) => {
    return VehicleType.findOne({ slug });
  };

  createVehicleType = async (data) => {
    return VehicleType.create(data);
  };

  updateVehicleType = async (id, data) => {
    return VehicleType.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  };

  deleteVehicleType = async (id) => {
    return VehicleType.findByIdAndDelete(id);
  };
}
