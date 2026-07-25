import mongoose from 'mongoose';

const appContentSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      lowercase: true,
      trim: true, // e.g. "terms", "privacy-policy"
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    iconName: {
      type: String,
      trim: true, // react-native material icon name, e.g. "file-document"
    },
    type: {
      type: String,
      enum: ['user', 'driver'],
      required: [true, 'Type is required'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'], // HTML page
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Slug is unique within an app type (user/driver may share a slug)
appContentSchema.index({ slug: 1, type: 1 }, { unique: true });

export const AppContent = mongoose.model('AppContent', appContentSchema);
