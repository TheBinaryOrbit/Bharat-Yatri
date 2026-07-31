import { env } from '../config/env.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A bare YYYY-MM-DD is a calendar day where the rider is, not in UTC. Filtering "today" from
// India must not hand back a window shifted by 5:30 — so the day is anchored to the app's offset.
const OFFSET_MS = env.APP_UTC_OFFSET_MINUTES * 60 * 1000;

const startOfDay = (day) => new Date(Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS);
const endOfDay = (day) => new Date(Date.parse(`${day}T23:59:59.999Z`) - OFFSET_MS);

// One end of the range. A date-only value widens to the whole day — inclusive on both sides —
// while a full ISO timestamp is taken as the exact instant it names.
const parseBoundary = (value, field, edge, errors) => {
  if (typeof value !== 'string') {
    errors.push({ field, message: `${field} must be a single value` });
    return null;
  }

  if (DATE_ONLY.test(value)) {
    const at = edge === 'start' ? startOfDay(value) : endOfDay(value);
    if (Number.isNaN(at.getTime())) {
      errors.push({ field, message: `${field} is not a real date` });
      return null;
    }
    return at;
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    errors.push({ field, message: `${field} must be YYYY-MM-DD or an ISO timestamp` });
    return null;
  }
  return new Date(ms);
};

// Turns a { date } or { from, to } query pair into a Mongo range predicate, pushing anything
// malformed onto `errors`. Returns null when no date filter was asked for — callers spread the
// result in, so "no filter" and "bad filter" both leave the query untouched.
//
//   { date: '2026-07-30' }                  -> that one day
//   { from: '2026-07-01', to: '2026-07-30' } -> inclusive range
//   { from: '2026-07-01' }                  -> that day onwards (`to` alone works the same way)
export const parseDateRange = ({ date, from, to }, errors) => {
  if (date && (from || to)) {
    errors.push({ field: 'date', message: 'Use date for a single day or from/to for a range, not both' });
    return null;
  }

  const startValue = date ?? from;
  const endValue = date ?? to;
  if (!startValue && !endValue) return null;

  const startField = date ? 'date' : 'from';
  const endField = date ? 'date' : 'to';

  const start = startValue ? parseBoundary(startValue, startField, 'start', errors) : null;
  // A single `date` is one value spanning both ends — validated once, so it can't be reported twice
  if (date && !start) return null;

  const end = endValue ? parseBoundary(endValue, endField, 'end', errors) : null;

  if (!start && !end) return null;

  if (start && end && start > end) {
    errors.push({ field: startField, message: `${startField} must be on or before ${endField}` });
    return null;
  }

  return {
    ...(start && { $gte: start }),
    ...(end && { $lte: end }),
  };
};
