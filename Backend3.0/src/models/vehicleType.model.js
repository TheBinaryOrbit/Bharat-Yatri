import mongoose from 'mongoose';

const vehicleTypeSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true, // e.g. "bharat_mini"
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
    },
    ratePerKm: {
      type: Number,
      required: [true, 'Rate per km is required'],
    },
    ratePerMinute: {
      type: Number,
      required: [true, 'Rate per minute is required'],
    },
    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
    },
    icon: {
      type: String,
      default: '', // PNG image URL
    },
    // Selling points shown under the type in the app, e.g. "AC Available"
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const VehicleType = mongoose.model('VehicleType', vehicleTypeSchema);
