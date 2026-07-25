import { UserService } from '../services/user.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';

export class UserController {
  constructor() {
    this.userService = new UserService();
  }

  // GET /api/v3/users
  getUsers = async (req, res) => {
    try {
      const users = await this.userService.getAllUsers();
      return res.status(200).json({ count: users.length, data: users });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch users', message: 'Internal server error' });
    }
  };

  // GET /api/v3/users/me  (protected) — current user from the auth token
  getMe = async (req, res) => {
    return res.status(200).json(req.user);
  };

  // GET /api/v3/users/:id  (admin — later work)
  getUserById = async (req, res) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch user', message: 'Internal server error' });
    }
  };

  // POST /api/v3/users  → register a new user (after OTP verification)
  // Accepts multipart/form-data with an optional `profileImage` file.
  createUser = async (req, res) => {
    const { title, name, phoneNumber } = req.body;

    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (!phoneNumber) errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const existing = await this.userService.getUserByPhone(phoneNumber);
      if (existing) {
        return res.status(409).json({ message: 'Phone number already registered' });
      }

      const newUser = await this.userService.createUser({
        title,
        name,
        phoneNumber,
        profileImageUrl: req.file ? buildFileUrl(req, req.file.filename) : '',
      });
      return res.status(201).json(newUser);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to create user', message: 'Internal server error' });
    }
  };
}
