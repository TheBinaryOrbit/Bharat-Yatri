import mongoose from 'mongoose';
import { ONBOARDING_STEPS, KYC_STATUSES, KYC_METHODS } from '../constants/driver.constants.js';

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
    // The name on the Aadhaar, kept to compare against the name entered during onboarding.
    aadhaarName: { type: String },
  },
  { _id: false }
);

// The Aadhaar photos a driver uploads when they choose manual KYC instead of DigiLocker.
const manualKycSchema = new mongoose.Schema(
  {
    aadhaarFrontImageUrl: { type: String, default: '' },
    aadhaarBackImageUrl: { type: String, default: '' },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    // Not required at the schema level: the account is created at OTP verification, before the
    // driver has entered a name. The personal-details onboarding step is what requires it.
    name: {
      type: String,
      trim: true,
      default: '',
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
    // Kept in step with kycStatus === 'verified'; the go-online check still reads it.
    isKycCompleted: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: KYC_STATUSES,
      default: 'not_started',
    },
    kycMethod: {
      type: String,
      enum: [...KYC_METHODS, null],
      default: null,
    },
    manualKyc: {
      type: manualKycSchema,
      default: undefined,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    // The last onboarding step the driver finished: 0 none, 1 personal, 2 licence, 3 vehicle.
    // Each step is saved as it is submitted, so this is what lets a driver who closed the app
    // half way pick up where they stopped. isProfileComplete flips to true together with step 3.
    onboardingStep: {
      type: Number,
      default: 0,
      min: 0,
      max: ONBOARDING_STEPS.length,
    },
    kycFailedReason: {
      type: String,
      default: '',
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

// The admin review queue: manual KYC requests by status, oldest first.
driverSchema.index({ kycMethod: 1, kycStatus: 1, 'manualKyc.submittedAt': 1 });

export const Driver = mongoose.model('Driver', driverSchema);