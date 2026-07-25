import mongoose from 'mongoose';

const rcDetailsSchema = new mongoose.Schema(
  {
    frontImageUrl: { type: String, default: '' },
    backImageUrl: { type: String, default: '' },
  },
  { _id: false }
);

const insuranceExpirySchema = new mongoose.Schema(
  {
    month: { type: Number, min: 1, max: 12 },
    year: { type: Number },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required'],
    },
    vehicleTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      required: [true, 'Vehicle type is required'],
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    vehicleName: {
      type: String,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
    },
    seatingCapacity: {
      type: Number,
    },
    manufactureYear: {
      type: Number,
    },
    insuranceExpiry: {
      type: insuranceExpirySchema,
      default: () => ({}),
    },
    // Up to 3 images (front / side / back)
    vehicleImages: {
      type: [String],
      default: [],
    },
    rcDetails: {
      type: rcDetailsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
