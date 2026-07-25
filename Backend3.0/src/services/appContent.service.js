import mongoose from 'mongoose';
import { AppContent } from '../models/appContent.model.js';

export class AppContentService {
  // All content for an app type (user|driver). Lightweight list (no HTML body).
  getAllByType = async (type) => {
    return AppContent.find({ type, isActive: true }).select('-content').sort({ name: 1 });
  };

  // A single item by Mongo id OR slug, scoped to the given app type.
  getByIdOrSlug = async (idOrSlug, type) => {
    if (mongoose.isValidObjectId(idOrSlug)) {
      return AppContent.findOne({ _id: idOrSlug, type });
    }
    return AppContent.findOne({ slug: String(idOrSlug).toLowerCase(), type });
  };

  create = async (data) => {
    return AppContent.create(data);
  };

  update = async (id, data) => {
    return AppContent.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  };

  remove = async (id) => {
    return AppContent.findByIdAndDelete(id);
  };
}
