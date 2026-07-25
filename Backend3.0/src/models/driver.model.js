import mongoose from 'mongoose';

const dlDetailsSchema = new mongoose.Schema(
  {
    dlNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // only enforce uniqueness when a DL number is present
    },
    dlFrontImageUrl: {
      type: String,
      default: '',
    },
    dlBackImageUrl: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const kycDetailsSchema = new mongoose.Schema(
  {
    requestId: { type: String },
    status: { type: String },
    adharFileId: { type: String },
    aadhaarJpeg: { type: String },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true, // allows multiple docs without an email
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    profileImageUrl: {
      type: String,
      default: '',
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    address: {
      type: String,
      trim: true,
    },
    aadharCardNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // only enforce uniqueness when provided
    },
    dlDetails: {
      type: dlDetailsSchema,
      default: () => ({}),
    },
    fcmToken: {
      type: String,
      default: '',
    },
    isKycCompleted: {
      type: Boolean,
      default: false,
    },
    kycDetails: {
      type: kycDetailsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// One KYC document per person — the Signzy Aadhaar file id can't be reused
driverSchema.index({ 'kycDetails.adharFileId': 1 }, { unique: true, sparse: true });

export const Driver = mongoose.model('Driver', driverSchema);