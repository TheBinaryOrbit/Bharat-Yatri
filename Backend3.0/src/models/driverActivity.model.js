import mongoose from 'mongoose';
import { DRIVER_ACTIVITY_TYPES } from '../constants/driverActivity.constants.js';

// Append-only timeline of a driver's account: sign-ins, each onboarding step, every document
// uploaded, KYC attempts and what admins did to the account. Written by
// services/driverActivity.service.js, read on the driver's Activity tab in the admin portal.
const driverActivitySchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    type: { type: String, enum: DRIVER_ACTIVITY_TYPES, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    // Files uploaded in this action, with the URL they were saved at.
    uploads: [{ _id: false, field: String, label: String, url: String }],
    // Names of the text fields that were sent (values live on the profile, not here).
    fields: [{ type: String }],
    // Small, type-specific extras: step, method, reason, validation errors, vehicle number...
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
    actor: {
      kind: { type: String, enum: ['driver', 'admin', 'system'], default: 'driver' },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: '' },
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

driverActivitySchema.index({ driverId: 1, createdAt: -1 });
driverActivitySchema.index({ driverId: 1, category: 1, createdAt: -1 });
driverActivitySchema.index({ type: 1, createdAt: -1 });

export const DriverActivity = mongoose.model('DriverActivity', driverActivitySchema);
