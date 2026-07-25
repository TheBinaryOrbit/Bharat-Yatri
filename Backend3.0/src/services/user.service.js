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
}
