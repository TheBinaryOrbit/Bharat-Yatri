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

  // Called at OTP verification, so two quick verifies for the same new number can race. The
  // upsert makes the second one find the first one's account instead of failing on the index.
  findOrCreateByPhone = async (phoneNumber) => {
    return Driver.findOneAndUpdate(
      { phoneNumber },
      { $setOnInsert: { phoneNumber } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  };

  // Applies an admin's decision, only if the driver still has a manual request pending.
  // Returns null when there is nothing pending to review.
  reviewPendingManualKyc = async (id, updates) => {
    return Driver.findOneAndUpdate(
      { _id: id, kycMethod: 'manual', kycStatus: 'pending' },
      { $set: updates },
      { new: true, runValidators: true }
    );
  };

  // Manual KYC requests for the admin review queue, oldest first.
  getManualKycRequests = async (status) => {
    return Driver.find({ kycMethod: 'manual', kycStatus: status })
      .select('name phoneNumber profileImageUrl dob gender kycStatus kycMethod manualKyc kycFailedReason')
      .sort({ 'manualKyc.submittedAt': 1 });
  };

  updateDriver = async (id, updateData, options = {}) => {
    return Driver.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      ...options,
    });
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
