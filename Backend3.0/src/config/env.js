import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  BASE_URL: process.env.BASE_URL, // e.g. https://api.bharatyatri.com (optional)
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // 2factor.in OTP service
  OTP_KEY: process.env.OTP_KEY,
  OTP_DIGIT_LENGTH: process.env.OTP_DIGIT_LENGTH || 6,

  // Admin gate (temporary key-based auth for admin-only endpoints)
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,

  // Signzy DigiLocker KYC
  SIGNZY_BASE_URL: process.env.SIGNZY_BASE_URL,
  SIGNZY_API_KEY: process.env.SIGNZY_API_KEY,
  SIGNZY_CALLBACK_URL: process.env.SIGNZY_CALLBACK_URL, // base host; the API path + driverId are appended in code
  SIGNZY_SUCCESS_URL: process.env.SIGNZY_SUCCESS_URL,
  SIGNZY_FAILURE_URL: process.env.SIGNZY_FAILURE_URL,
};

// Fail fast if critical env vars are missing
const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !env[key]);

if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
