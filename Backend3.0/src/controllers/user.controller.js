import { UserService } from '../services/user.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';

// Same rule the schema enforces, checked here so a bad number answers 400 with a
// field-shaped error instead of falling through to the ValidationError branch.
const SOS_CONTACT_PATTERN = /^[6-9]\d{9}$/;

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

  // --- SOS contact ---------------------------------------------------------
  // The user is always taken from the auth token, never from the body or params.

  // GET /api/v3/users/me/sos-contact  (protected — user only)
  getSosContact = async (req, res) => {
    try {
      const sosContact = await this.userService.getSosContact(req.user._id);
      if (!sosContact) {
        return res.status(404).json({ message: 'SOS contact not found' });
      }
      return res.status(200).json({ sosContact });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch SOS contact', message: 'Internal server error' });
    }
  };

  // PUT /api/v3/users/me/sos-contact  (protected — user only)
  // Sets the number, whether or not one already exists.
  updateSosContact = async (req, res) => {
    const { sosContact } = req.body;

    if (!sosContact) {
      return res.status(400).json({
        message: 'SOS contact is required',
        errors: [{ field: 'sosContact', message: 'SOS contact is required' }],
      });
    }

    if (!SOS_CONTACT_PATTERN.test(String(sosContact).trim())) {
      return res.status(400).json({
        message: 'Invalid SOS contact',
        errors: [{ field: 'sosContact', message: 'SOS contact must be a 10-digit number starting with 6-9' }],
      });
    }

    try {
      const updated = await this.userService.setSosContact(req.user._id, String(sosContact).trim());
      if (!updated) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ sosContact: updated });
    } catch (error) {
      console.log(error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid SOS contact', error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update SOS contact', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/users/me/sos-contact  (protected — user only)
  deleteSosContact = async (req, res) => {
    try {
      const cleared = await this.userService.removeSosContact(req.user._id);
      if (!cleared) {
        return res.status(404).json({ message: 'SOS contact not found' });
      }
      return res.status(200).json({ message: 'SOS contact deleted' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to delete SOS contact', message: 'Internal server error' });
    }
  };
}
