import { PaymentDetails } from '../models/paymentDetails.model.js';

export class PaymentDetailsService {
  getByDriver = async (driverId) => {
    return PaymentDetails.findOne({ driverId });
  };

  // Creates the driver's payment details, or updates the UPI id if it exists
  upsertForDriver = async (driverId, upiId) => {
    return PaymentDetails.findOneAndUpdate(
      { driverId },
      { $set: { upiId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  };

  deleteForDriver = async (driverId) => {
    return PaymentDetails.findOneAndDelete({ driverId });
  };
}
