import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Ride start OTP — the code the rider reads out so the driver can begin the trip.
//
// Unrelated to otp.service.js, which is a 2factor.in SMS client: this code is never sent
// anywhere, it is displayed in the rider's app. crypto.randomInt, not Math.random, because
// it gates a physical handover.
export const generateStartOtp = () => {
  const max = 10 ** env.RIDE_START_OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(env.RIDE_START_OTP_LENGTH, '0');
};

// Credential for the shareable live-tracking link. base64url so it is safe in a URL path.
export const generateTrackingToken = () => crypto.randomBytes(16).toString('base64url');
