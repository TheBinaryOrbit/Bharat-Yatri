import { OTPService } from '../services/otp.service.js';
import { UserService } from '../services/user.service.js';
import { DriverService } from '../services/driver.service.js';
import { generateToken } from '../utils/token.js';

export class AuthController {
  constructor() {
    this.otpService = new OTPService();
    this.userService = new UserService();
    this.driverService = new DriverService();
  }

  // Picks the right service + response shape for a given role
  resolveRole = (role) => {
    if (role === 'user') {
      return { service: this.userService, findByPhone: this.userService.getUserByPhone };
    }
    if (role === 'driver') {
      return { service: this.driverService, findByPhone: this.driverService.getDriverByPhone };
    }
    return null;
  };

  // POST /api/v3/auth/otp  → send an OTP
  getOTP = async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      console.log('Get OTP:', phoneNumber);

      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
      }

      const otpStatus = await this.otpService.sendOTP(phoneNumber);
      console.log('OTP Status:', otpStatus);

      if (!otpStatus.status) {
        return res.status(503).json({ error: 'Failed to send OTP. Service unavailable.' });
      }

      return res.status(200).json({
        message: 'OTP sent successfully.',
        sessionId: otpStatus.sessionId,
      });
    } catch (error) {
      console.error('getOTP Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // POST /api/v3/auth/verify  → verify OTP, return account + JWT (or userStatus 404)
  verifyOTP = async (req, res) => {
    try {
      const { phoneNumber, otp, sessionId, fcmToken, role } = req.body;

      const errors = [];
      if (!phoneNumber) errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
      if (!otp) errors.push({ field: 'otp', message: 'OTP is required' });
      if (!sessionId) errors.push({ field: 'sessionId', message: 'Session ID is required' });
      if (!role) errors.push({ field: 'role', message: 'Role is required' });
      if (errors.length) {
        return res.status(400).json({ message: 'All fields are required', errors });
      }

      const resolved = this.resolveRole(role);
      if (!resolved) {
        return res.status(400).json({ message: "Role must be one of: 'user', 'driver'" });
      }

      const isValid = await this.otpService.verifyOTP(phoneNumber, otp, sessionId);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
      }

      const account = await resolved.findByPhone(phoneNumber);


      if(role =='driver' && account?.isKycCompleted == true && account?.isProfileComplete == false){
        return res.status(200).json({
          message: 'OTP verified successfully, but Setup Incomplete.',
          userStatus: 404,
        });
      }

      // OTP matched but no account yet → frontend routes to registration
      if (!account) {
        return res.status(200).json({
          message: 'OTP verified successfully, but account not found.',
          userStatus: 404,
        });
      }

      // Persist the latest FCM token
      const updated = await resolved.service.updateFcmToken(phoneNumber, fcmToken || account.fcmToken);

      const token = generateToken({ id: updated._id, role });

      return res.status(200).json({
        message: 'OTP verified successfully.',
        userStatus: 200,
        token,
        role,
        user: updated,
      });
    } catch (error) {
      console.error('verifyOTP Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
