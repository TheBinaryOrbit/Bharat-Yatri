import { env } from '../config/env.js';
import { BOOKING_TYPES } from '../constants/ride.constants.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Same anchoring as dateRange.js: a bare date and a wall-clock time are what the rider sees on
// their phone, not UTC. '2026-08-05 09:30' booked from India means 04:00Z, and getting that wrong
// by 5:30 would silently move every scheduled trip.
const OFFSET_MS = env.APP_UTC_OFFSET_MINUTES * 60 * 1000;

// Resolves the pickup instant for an outstation booking, following parseDateRange's contract:
// push { field, message } onto `errors` and return null, so the caller answers with one 400.
//
// Two input forms are accepted on purpose, and exactly one may be used at a time:
//
//   { bookingType: 'later', pickupDate: '2026-08-05', pickupTime: '09:30' }
//   { bookingType: 'later', pickupAt: '2026-08-05T04:00:00.000Z' }
//
// The pair is what a native date/time picker naturally produces and is unambiguous about WHICH
// local 9:30 is meant; the ISO form is what a web client holding a real Date already has. Forcing
// either one on the other would push a timezone conversion into the client, which is where these
// bugs come from.
//
// 'now' is a hail: the server sets the instant itself and any pickup fields sent alongside are
// ignored rather than rejected, because an app that keeps its picker mounted while the rider
// toggles back to "leave now" should not have to clear it.
export const parsePickupAt = ({ bookingType, pickupAt, pickupDate, pickupTime }, errors) => {
  const type = bookingType === undefined || bookingType === null || bookingType === '' ? 'now' : bookingType;

  if (!BOOKING_TYPES.includes(type)) {
    errors.push({ field: 'bookingType', message: `bookingType must be one of: ${BOOKING_TYPES.join(', ')}` });
    return null;
  }

  if (type === 'now') return { bookingType: type, pickupAt: new Date() };

  const hasIso = typeof pickupAt === 'string' && pickupAt.trim() !== '';
  const hasPair = Boolean(pickupDate) || Boolean(pickupTime);

  if (hasIso && hasPair) {
    errors.push({
      field: 'pickupAt',
      message: 'Send pickupAt as an ISO timestamp, or pickupDate and pickupTime — not both',
    });
    return null;
  }

  if (!hasIso && !hasPair) {
    errors.push({
      field: 'pickupAt',
      message: 'A scheduled ride needs pickupAt (ISO timestamp) or pickupDate (YYYY-MM-DD) and pickupTime (HH:mm)',
    });
    return null;
  }

  let at;

  if (hasIso) {
    const ms = Date.parse(pickupAt);
    if (Number.isNaN(ms)) {
      errors.push({ field: 'pickupAt', message: 'pickupAt must be an ISO timestamp' });
      return null;
    }
    at = new Date(ms);
  } else {
    if (!DATE_ONLY.test(String(pickupDate ?? ''))) {
      errors.push({ field: 'pickupDate', message: 'pickupDate must be YYYY-MM-DD' });
      return null;
    }
    if (!TIME_ONLY.test(String(pickupTime ?? ''))) {
      errors.push({ field: 'pickupTime', message: 'pickupTime must be HH:mm in 24-hour time' });
      return null;
    }

    const ms = Date.parse(`${pickupDate}T${pickupTime}:00.000Z`);
    if (Number.isNaN(ms)) {
      errors.push({ field: 'pickupDate', message: 'pickupDate is not a real date' });
      return null;
    }

    // Date.parse is NOT strict about day-of-month: '2026-02-31' silently becomes March 3rd rather
    // than failing. Round-tripping the parsed day back to a string is what catches that — without
    // it a rider who picked an impossible date would be booked onto a different one and never told.
    const asUtc = new Date(ms);
    if (asUtc.toISOString().slice(0, 10) !== pickupDate) {
      errors.push({ field: 'pickupDate', message: 'pickupDate is not a real date' });
      return null;
    }

    at = new Date(ms - OFFSET_MS);
  }

  const now = Date.now();

  // The lead time is not politeness — it is what stops a scheduled ride being created with an
  // expiry window too short for any driver to see it, let alone bid on it.
  if (at.getTime() < now + env.OUTSTATION_MIN_LEAD_MINUTES * 60 * 1000) {
    errors.push({
      field: 'pickupAt',
      message: `Pickup must be at least ${env.OUTSTATION_MIN_LEAD_MINUTES} minutes from now`,
    });
    return null;
  }

  // An accepted ride holds its driver's single outstation slot until it happens, so an unbounded
  // booking horizon is an unbounded lockout.
  if (at.getTime() > now + env.OUTSTATION_MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000) {
    errors.push({
      field: 'pickupAt',
      message: `Pickup cannot be more than ${env.OUTSTATION_MAX_ADVANCE_DAYS} days ahead`,
    });
    return null;
  }

  return { bookingType: type, pickupAt: at };
};
