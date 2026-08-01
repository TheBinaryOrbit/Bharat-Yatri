import { isValidCoordinate } from './geo.js';

// Request-shaped validation helpers. They all follow the same contract as parseDateRange: push
// { field, message } onto the caller's `errors` array and return null, so a controller collects
// every problem in one pass and answers with a single 400.
//
// Deliberately NOT in geo.js — that file is pure geometry with no notion of a request or an
// errors array, and mixing the two is how a utility module turns into a junk drawer.

// Accepts { latitude, longitude } and reports which field is wrong.
export const validateCoordinates = (value, field, errors) => {
  if (!value || typeof value !== 'object') {
    errors.push({ field, message: `${field} is required` });
    return null;
  }

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);

  if (!isValidCoordinate(latitude, longitude)) {
    errors.push({ field, message: `${field} must have a valid latitude and longitude` });
    return null;
  }

  return { latitude, longitude };
};

// Accepts one status or a comma-separated list, and rejects anything outside the enum rather than
// silently returning an empty history for a typo.
//
// `allowed` is passed in because the two ride modules have different status sets — outstation has
// an 'arriving' phase QuickRide does not. Each caller hands over its own model enum, so a filter
// can never drift from the schema it is filtering.
export const parseRideStatuses = (raw, errors, allowed) => {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw !== 'string') {
    errors.push({ field: 'status', message: 'status must be a single value or a comma-separated list' });
    return null;
  }

  const statuses = raw
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean);

  const unknown = statuses.filter((status) => !allowed.includes(status));
  if (unknown.length) {
    errors.push({
      field: 'status',
      message: `Unknown status: ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`,
    });
    return null;
  }

  return statuses.length ? statuses : null;
};
