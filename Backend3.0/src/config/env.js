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

  // Outstation rides — long-distance, schedulable trips. A separate collection and lifecycle from
  // QuickRide; these six numbers are very nearly the whole of what differs between the two.
  //
  // The minimum is deliberately equal to MAX_RIDE_DISTANCE_KM by default, and the two checks are
  // inclusive on both sides (QuickRide rejects `> max`, outstation rejects `< min`), so a trip of
  // exactly 100 km can be booked either way. A gap here would produce routes that are "too long"
  // for one product and "too short" for the other.
  OUTSTATION_MIN_DISTANCE_KM: Number(process.env.OUTSTATION_MIN_DISTANCE_KM || 100),

  // How long an unclaimed outstation ride stays out for bids. Capped by pickupAt for 'later'
  // bookings — a trip cannot still be looking for a driver after it was due to leave.
  OUTSTATION_RIDE_TTL_HOURS: Number(process.env.OUTSTATION_RIDE_TTL_HOURS || 24),

  // Minimum notice for a 'later' booking. Also what stops a scheduled ride being created with an
  // expiry window too short for any driver to see it, let alone bid on it.
  OUTSTATION_MIN_LEAD_MINUTES: Number(process.env.OUTSTATION_MIN_LEAD_MINUTES || 60),

  // Upper bound on how far ahead a trip may be booked. Not a correctness requirement — the TTL
  // above already kills an unclaimed far-future ride — but an ACCEPTED one holds its driver's
  // single outstation slot until it happens, so an unbounded horizon is an unbounded lockout.
  OUTSTATION_MAX_ADVANCE_DAYS: Number(process.env.OUTSTATION_MAX_ADVANCE_DAYS || 30),

  // A single fixed sweep, not an expanding ring. QuickRide widens from 2km because it needs the
  // nearest driver in seconds; an outstation ride has hours and is chosen on price, so the ring
  // machinery's "stop at the first non-empty radius" rule would only shrink the bid pool.
  OUTSTATION_SEARCH_RADIUS_KM: Number(process.env.OUTSTATION_SEARCH_RADIUS_KM || 20),

  // How long before an outstation pickup a driver stops being offered QuickRides. They keep
  // earning right up to this line, then they are reserved until the outstation ride is terminal.
  OUTSTATION_QUICKRIDE_BLOCK_MINUTES: Number(process.env.OUTSTATION_QUICKRIDE_BLOCK_MINUTES || 120),

  // Firebase Cloud Messaging — push notifications.
  //
  // Only these three of the FIREBASE_* keys in .env are read: they are the whole of what
  // admin.credential.cert() consumes. The rest (client id, auth/token URIs, cert URLs) belong to
  // the downloaded service-account JSON and the Admin SDK derives or ignores every one of them.
  //
  // The private key is stored as a single line with literal \n escapes, which is the only way a
  // PEM survives a .env file. dotenv unescapes those for a double-quoted value, but an unquoted
  // or re-exported copy would not, so the replace below is the belt to that braces.
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),

  // Kill switch. Push is disabled outright when false — every notify() call becomes a no-op,
  // which is what you want in a test run that must not fan out to real devices.
  PUSH_ENABLED: String(process.env.PUSH_ENABLED ?? 'true') !== 'false',

  // How long before an outstation pickup the assigned driver is reminded, in minutes.
  // Read as a descending ladder; the sweeper fires the tightest one that is due and quietly
  // swallows any wider one it has slept past, so a restart cannot deliver three at once.
  OUTSTATION_REMINDER_OFFSETS_MINUTES: String(process.env.OUTSTATION_REMINDER_OFFSETS_MINUTES || '180,120,60,30')
    .split(',')
    .map((minutes) => Number(String(minutes).trim()))
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .sort((a, b) => a - b),

  // The reminder sweep is minute-grained by nature — a 3-hour reminder does not care about
  // seconds — so it runs on its own far slower interval than the expiry sweeper.
  REMINDER_SWEEP_INTERVAL_MS: Number(process.env.REMINDER_SWEEP_INTERVAL_MS || 60000),
};

// Fail fast if critical env vars are missing
const required = ['MONGO_URI', 'JWT_SECRET', 'GOOGLE_MAPS_API_KEY'];
const missing = required.filter((key) => !env[key]);

if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
