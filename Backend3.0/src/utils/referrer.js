import { MAX_UTM_LENGTH } from '../constants/install.constants.js';

// A Play Install Referrer is a query string with no leading '?':
//
//   organic     "utm_source=google-play&utm_medium=organic"
//   our links   "utm_source=whatsapp&utm_medium=social&utm_campaign=launch"
//   Meta ads    an opaque payload Meta owns, which may carry no utm_* keys at all
//
// So nothing in here throws or rejects on a shape it does not recognise: the raw string is always
// stored as sent, and these parsed fields are a convenience for grouping, not the source of truth.

// A value we can index and group on. `+` already means space to URLSearchParams, and the store
// double-encodes some referrers, hence the second decode attempt.
const clean = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_UTM_LENGTH);
};

// source and medium are folded to lower case because they are the two fields reports group BY —
// "WhatsApp" and "whatsapp" arriving from two different links must not split into two rows.
// campaign/content/term are left exactly as written: they are labels a human reads back.
const lower = (value) => {
  const cleaned = clean(value);
  return cleaned && cleaned.toLowerCase();
};

export const parseInstallReferrer = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return {};

  let params;
  try {
    params = new URLSearchParams(raw.trim());
  } catch {
    return {};
  }

  return {
    source: lower(params.get('utm_source')),
    medium: lower(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
    term: clean(params.get('utm_term')),
  };
};

// Anything at or above this read as seconds would land past the year 5000, so it is milliseconds.
// The Play library documents `installBeginTimestampSeconds` as seconds, but the field crosses a
// JSON boundary written by hand on the app side and a client sending Date.now() is the likely slip.
const MILLISECONDS_THRESHOLD = 1e11;

// Play's install/click timestamps → a Date. Returns null for anything that is not a usable instant,
// so the caller decides whether the field was required.
export const toInstallDate = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;

  const ms = number >= MILLISECONDS_THRESHOLD ? number : number * 1000;
  const at = new Date(ms);
  return Number.isNaN(at.getTime()) ? null : at;
};
