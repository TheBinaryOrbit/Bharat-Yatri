import mongoose from 'mongoose';

const paymentDetailsSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required'],
      unique: true, // one payment-details record per driver
    },
    upiId: {
      type: String,
      required: [true, 'UPI id is required'],
      trim: true,
      match: [/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI id'],
    },
  },
  { timestamps: true }
);

export const PaymentDetails = mongoose.model('PaymentDetails', paymentDetailsSchema);
