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
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
