import { QuickDestination } from '../models/quickDestination.model.js';

// Every write is scoped by userId inside the query predicate rather than read-then-check, so one
// rider can never reach another's shortcut by guessing an id — and there is no window between the
// ownership check and the write in which anything could change.
export class QuickDestinationService {
  getForUser = async (userId) => {
    return QuickDestination.find({ userId }).sort({ createdAt: -1 });
  };

  getForUserById = async (id, userId) => {
    return QuickDestination.findOne({ _id: id, userId });
  };

  countForUser = async (userId) => {
    return QuickDestination.countDocuments({ userId });
  };

  create = async (data) => {
    return QuickDestination.create(data);
  };

  updateForUser = async (id, userId, data) => {
    return QuickDestination.findOneAndUpdate({ _id: id, userId }, data, { new: true, runValidators: true });
  };

  deleteForUser = async (id, userId) => {
    return QuickDestination.findOneAndDelete({ _id: id, userId });
  };
}
