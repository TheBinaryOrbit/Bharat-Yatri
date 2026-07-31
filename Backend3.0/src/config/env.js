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

  // Redis — driver location GEO index
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Google Distance Matrix — ride distance/duration estimates
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  // QuickRide lifecycle.
  // Numbers are coerced here because process.env values are strings and these are used in arithmetic.
  MAX_RIDE_DISTANCE_KM: Number(process.env.MAX_RIDE_DISTANCE_KM || 100),
  RIDE_PENDING_TTL_SECONDS: Number(process.env.RIDE_PENDING_TTL_SECONDS || 300), // ride auto-cancels after 5 min
  BID_TTL_SECONDS: Number(process.env.BID_TTL_SECONDS || 60), // bids are hard-deleted after this
  EXPIRY_SWEEP_INTERVAL_MS: Number(process.env.EXPIRY_SWEEP_INTERVAL_MS || 5000),

  // Driver discovery — search rings widen until drivers are found
  DRIVER_SEARCH_RADIUS_START_KM: Number(process.env.DRIVER_SEARCH_RADIUS_START_KM || 2),
  DRIVER_SEARCH_RADIUS_MAX_KM: Number(process.env.DRIVER_SEARCH_RADIUS_MAX_KM || 10),
  DRIVER_SEARCH_RADIUS_STEP_KM: Number(process.env.DRIVER_SEARCH_RADIUS_STEP_KM || 2),
  DRIVER_LOCATION_TTL_SECONDS: Number(process.env.DRIVER_LOCATION_TTL_SECONDS || 30), // app pings every 5s

  // How long a disconnected driver's Redis entry is parked before it is dropped. A tunnel, a lift
  // or a backgrounded app must not cost the driver their place — they reconnect and resume.
  DRIVER_DISCONNECT_GRACE_SECONDS: Number(process.env.DRIVER_DISCONNECT_GRACE_SECONDS || 300),

  // Rider offer band, as multipliers of the system-suggested fare — how far the rider
  // may move off the suggestion in either direction
  OFFER_MIN_MULTIPLIER: Number(process.env.OFFER_MIN_MULTIPLIER || 0.8),
  OFFER_MAX_MULTIPLIER: Number(process.env.OFFER_MAX_MULTIPLIER || 1.5),

  // Bid fare band, as multipliers of the rider's offered fare
  BID_MIN_MULTIPLIER: Number(process.env.BID_MIN_MULTIPLIER || 0.8),
  BID_MAX_MULTIPLIER: Number(process.env.BID_MAX_MULTIPLIER || 1.5),

  // Ride start OTP — separate from OTP_DIGIT_LENGTH, which belongs to the 2factor.in login flow
  RIDE_START_OTP_LENGTH: Number(process.env.RIDE_START_OTP_LENGTH || 4),
  RIDE_START_OTP_MAX_ATTEMPTS: Number(process.env.RIDE_START_OTP_MAX_ATTEMPTS || 5),

  // Location sanity check — fixes implying a faster jump than this are dropped as bad GPS
  MAX_LOCATION_JUMP_KMPH: Number(process.env.MAX_LOCATION_JUMP_KMPH || 200),

  // Front-end base for the shareable live-tracking link
  TRACKING_LINK_BASE_URL: process.env.TRACKING_LINK_BASE_URL || '',

  // The zone a bare YYYY-MM-DD date filter means, as minutes ahead of UTC. 330 = IST.
  APP_UTC_OFFSET_MINUTES: Number(process.env.APP_UTC_OFFSET_MINUTES || 330),
};

// Fail fast if critical env vars are missing
const required = ['MONGO_URI', 'JWT_SECRET', 'GOOGLE_MAPS_API_KEY'];
const missing = required.filter((key) => !env[key]);

if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
