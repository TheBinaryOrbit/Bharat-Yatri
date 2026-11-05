import mongoose from 'mongoose';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../constants/admin.constants.js';
import { parseDateRange } from '../../utils/dateRange.js';

// Small shared pieces for the admin controllers. Every admin list is paginated as
// ?page=1&limit=20 and answers { data, total, page, limit, pages }.

export const pageParams = (query) => {
  const page = Math.max(Math.trunc(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.trunc(Number(query.limit)) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
};

// Column sort from ?sortBy=<key>&order=asc|desc. `allowed` maps the public key to a field path
// (or a list of paths for tie-breaks); unknown keys get `fallback`. _id keeps paging stable.
export const sortParams = (query, allowed, fallback) => {
  const fields = allowed[query?.sortBy];
  if (!fields) return fallback;
  const dir = query.order === 'asc' ? 1 : -1;
  const sort = {};
  [].concat(fields).forEach((f) => {
    sort[f] = dir;
  });
  sort._id = dir;
  return sort;
};

export const listResponse =(res, { data, total, page, limit, ...extra }) =>
  res.status(200).json({ data, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1), ...extra });

export const badRequest = (res, errors, message = 'Please fix the highlighted fields') =>
  res.status(400).json({ message, errors });

export const isId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;

export const toId = (value) => new mongoose.Types.ObjectId(String(value));

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive "contains" match on a user-typed search string.
export const containsRegex = (value) => new RegExp(escapeRegex(String(value).trim()), 'i');

// Date filter from ?from&to (or ?date), IST-anchored like the rest of the API.
export const dateFilter = (query, errors) => parseDateRange({ date: query.date, from: query.from, to: query.to }, errors);

// Wraps an async handler so an unexpected throw becomes a clean 500 instead of a hung request.
export const handle = (label, fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (error) {
    console.error(`[admin] ${label} failed:`, error);
    if (error?.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
      return badRequest(res, errors);
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      return res.status(409).json({ message: `That ${field} is already in use`, errors: [{ field, message: 'Already in use' }] });
    }
    return res.status(500).json({ message: `Could not ${label}. Please try again.` });
  }
};

// Reason text for sensitive actions: required, trimmed, bounded.
export const readReason = (body, errors, { required = true } = {}) => {
  const reason = String(body?.reason ?? '').trim();
  if (required && !reason) errors.push({ field: 'reason', message: 'A reason is required' });
  if (reason.length > 500) errors.push({ field: 'reason', message: 'Keep the reason under 500 characters' });
  return reason;
};

// --- PII masking -------------------------------------------------------------------------------
// Roles without pii.view see 98•••••210 instead of the full number.

export const maskPhone = (value) => {
  const s = String(value || '');
  if (s.length < 6) return s ? '•••' : '';
  return `${s.slice(0, 2)}${'•'.repeat(s.length - 5)}${s.slice(-3)}`;
};

export const maskTail = (value, keep = 4) => {
  const s = String(value || '');
  if (!s) return '';
  return `${'•'.repeat(Math.max(s.length - keep, 3))}${s.slice(-keep)}`;
};

export const maskUpi = (value) => {
  const s = String(value || '');
  const at = s.indexOf('@');
  if (at < 0) return maskTail(s, 2);
  return `${s.slice(0, Math.min(2, at))}•••${s.slice(at)}`;
};

export const canSeePii = (req) => req.permissions?.has('pii.view');

// Applies masking to the common person fields in place on a plain object (lean result).
export const maskPerson = (req, person) => {
  if (!person || canSeePii(req)) return person;
  if (person.phoneNumber) person.phoneNumber = maskPhone(person.phoneNumber);
  if (person.sosContact) person.sosContact = maskPhone(person.sosContact);
  if (person.aadharCardNumber) person.aadharCardNumber = maskTail(person.aadharCardNumber);
  if (person.email) person.email = person.email.replace(/^(.).*(@.*)$/, '$1•••$2');
  return person;
};

// Fields never sent to the portal at all.
export const DRIVER_HIDDEN = '-fcmToken -kycDetails.aadhaarJpeg';
export const USER_HIDDEN = '-fcmToken';
