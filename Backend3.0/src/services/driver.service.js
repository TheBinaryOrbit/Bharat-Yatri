import { Driver } from '../models/driver.model.js';

export class DriverService {
  getAllDrivers = async () => {
    return Driver.find();
  };

  getDriverById = async (id) => {
    return Driver.findById(id);
  };

  getDriverByPhone = async (phoneNumber) => {
    return Driver.findOne({ phoneNumber });
  };

  getDriverByKycFileId = async (adharFileId) => {
    return Driver.findOne({ 'kycDetails.adharFileId': adharFileId });
  };

  createDriver = async (driverData) => {
    return Driver.create(driverData);
  };

  updateDriver = async (id, updateData) => {
    return Driver.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  };

  updateFcmToken = async (phoneNumber, fcmToken) => {
    return Driver.findOneAndUpdate(
      { phoneNumber },
      { $set: { fcmToken } },
      { new: true, runValidators: true }
    );
  };

  deleteDriver = async (id) => {
    return Driver.findByIdAndDelete(id);
  };
}
