import mongoose from 'mongoose';
import { ADMIN_ROLE_KEYS } from '../constants/admin.constants.js';

// A person who signs in to the admin portal. Separate from User/Driver: different login
// (email + password, not OTP), different token claim (role 'admin'), different lifecycle.
const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ADMIN_ROLE_KEYS,
      required: [true, 'Role is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Bumped on password change, role change or deactivation. Tokens carry the value they were
    // issued with, so bumping it signs the admin out everywhere.
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Admin = mongoose.model('Admin', adminSchema);
