import axios from 'axios';
import { env } from '../config/env.js';

export class OTPService {
  // Sends an OTP via 2factor.in and returns the sessionId to verify against
  sendOTP = async (phoneNumber) => {
    try {
      const template = env.OTP_DIGIT_LENGTH == 4 ? '3' : '2';
      const response = await axios.get(
        `https://2factor.in/API/V1/${env.OTP_KEY}/SMS/${phoneNumber}/AUTOGEN${template}/OTP on Login`
      );

      const { Status, Details } = response.data;
      console.log('OTP Response:', response.data);

      if (Status === 'Success') {
        return { status: true, sessionId: Details };
      }
      return { status: false, message: 'Failed to send OTP' };
    } catch (error) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      return { status: false, message: 'Error sending OTP' };
    }
  };

  // Verifies an OTP against a sessionId. Returns true/false.
  verifyOTP = async (phoneNumber, otp, sessionId) => {
    try {
      // Testing bypass — remove or guard before production
      if ((phoneNumber === '6203821043' || phoneNumber === '6203821044') && otp === '123456') {
        return true;
      }

      const response = await axios.get(
        `https://2factor.in/API/V1/${env.OTP_KEY}/SMS/VERIFY/${sessionId}/${otp}`
      );
      const { Status, Details } = response.data;

      return Status === 'Success' && Details === 'OTP Matched';
    } catch (error) {
      console.error('OTP verification failed:', error.response?.data || error.message);
      return false;
    }
  };
}
