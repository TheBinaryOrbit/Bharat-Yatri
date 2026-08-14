import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
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
    fcmToken: {
      type: String,
      default: '',
    },
    // Number to alert if something goes wrong during a ride. No default, so an
    // unset contact reads as `undefined` rather than an empty string.
    sosContact: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'SOS contact must be a 10-digit number starting with 6-9'],
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
