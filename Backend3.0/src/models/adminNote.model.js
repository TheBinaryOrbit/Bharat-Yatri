import mongoose from 'mongoose';
import { NOTE_ENTITIES } from '../constants/admin.constants.js';

// An internal note an admin leaves on a customer, driver, vehicle or ride. Never shown in the apps.
const adminNoteSchema = new mongoose.Schema(
  {
    entity: { type: String, enum: NOTE_ENTITIES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    body: {
      type: String,
      required: [true, 'Note cannot be empty'],
      trim: true,
      maxlength: [2000, 'Note cannot be longer than 2000 characters'],
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: true }
);

adminNoteSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AdminNote = mongoose.model('AdminNote', adminNoteSchema);
