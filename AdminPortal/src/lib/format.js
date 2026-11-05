// Display formats used everywhere: en-IN numbers, INR without decimals, dd MMM yyyy dates (IST).

const TZ = 'Asia/Kolkata';
const num = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const fmtNumber = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : num.format(Number(n)));
export const fmtMoney = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : inr.format(Number(n)));
export const fmtPercent = (r, digits = 0) => (r == null ? '—' : `${(r * 100).toFixed(digits)}%`);
export const fmtDecimal = (n, digits = 1) => (n == null ? '—' : Number(n).toFixed(digits));

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }) : '—';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
      })
    : '—';

export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—');

export const fmtAgo = (d) => {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const fmtSeconds = (s) => {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
};

export const fmtMinutes = (m) => {
  if (m == null) return '—';
  if (m < 1) return `${Math.round(m * 60)} s`;
  if (m < 60) return `${m.toFixed(1)} min`;
  return `${(m / 60).toFixed(1)} h`;
};

export const shortId = (id) => (id ? `#${String(id).slice(-6).toUpperCase()}` : '—');

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '—';

export const titleCase = (s = '') => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// YYYY-MM-DD for <input type="date"> in IST.
export const isoDay = (d = new Date()) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);
export const daysAgo = (n) => isoDay(Date.now() - n * 86400000);

export const RIDE_STATUS_LABEL = {
  searching: 'Searching',
  assigned: 'Assigned',
  arriving: 'Driver on the way',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const KYC_LABEL = { not_started: 'Not started', pending: 'Pending review', verified: 'Verified', rejected: 'Rejected' };
