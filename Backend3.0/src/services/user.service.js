import { User } from '../models/user.model.js';

export class UserService {
  getAllUsers = async () => {
    return User.find();
  };

  getUserById = async (id) => {
    return User.findById(id);
  };

  getUserByPhone = async (phoneNumber) => {
    return User.findOne({ phoneNumber });
  };

  createUser = async (userData) => {
    return User.create(userData);
  };

  updateUser = async (id, updateData) => {
    return User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  };

  updateFcmToken = async (phoneNumber, fcmToken) => {
    return User.findOneAndUpdate(
      { phoneNumber },
      { $set: { fcmToken } },
      { new: true, runValidators: true }
    );
  };

  deleteUser = async (id) => {
    return User.findByIdAndDelete(id);
  };

  // --- SOS contact ---------------------------------------------------------
  // Returns the number only, or null when the user has never set one.
  getSosContact = async (id) => {
    const user = await User.findById(id).select('sosContact');
    return user?.sosContact || null;
  };

  setSosContact = async (id, sosContact) => {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { sosContact } },
      { new: true, runValidators: true }
    ).select('sosContact');
    return user?.sosContact || null;
  };

  // Matches only when a contact is actually set, so the controller can answer 404
  // from a null return instead of reading the document twice.
  removeSosContact = async (id) => {
    return User.findOneAndUpdate(
      { _id: id, sosContact: { $exists: true, $nin: [null, ''] } },
      { $unset: { sosContact: '' } },
      { new: true }
    );
  };
}
