import { env } from '../../config/env.js';

// Shared aggregation bits for the dashboard and reports.

// "+05:30" from APP_UTC_OFFSET_MINUTES, for $dateToString / $dateTrunc so days are IST days.
export const TZ = (() => {
  const m = env.APP_UTC_OFFSET_MINUTES;
  const sign = m >= 0 ? '+' : '-';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
})();

export const dayKey = (field = '$createdAt') => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

// Default window when a report is opened without dates: the last 30 IST days, today included.
export const defaultRange = (range) => {
  if (range) return range;
  const now = new Date();
  const start = new Date(now.getTime() - 29 * 86400000);
  const offset = env.APP_UTC_OFFSET_MINUTES * 60000;
  const localStart = new Date(Math.floor((start.getTime() + offset) / 86400000) * 86400000 - offset);
  return { $gte: localStart, $lte: now };
};

// Every IST day between the range ends, so charts show zero days instead of skipping them.
export const daysBetween = (range) => {
  const offset = env.APP_UTC_OFFSET_MINUTES * 60000;
  const toKey = (d) => new Date(d.getTime() + offset).toISOString().slice(0, 10);
  const out = [];
  const end = toKey(range.$lte ?? new Date());
  let cursor = new Date(`${toKey(range.$gte)}T00:00:00Z`);
  for (let i = 0; i < 400; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    out.push(key);
    if (key >= end) break;
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
};

export const countBy = (rows, key = '_id') => Object.fromEntries(rows.map((r) => [r[key] ?? 'unknown', r.count]));

// The "area" of a Google-formatted address: "Shop 4, Sector 18, Noida, Uttar Pradesh 201301, India"
// → "Noida". Heuristic (third segment from the end); reports label it as derived from the address.
export const areaExpr = (field) => ({
  $let: {
    vars: { parts: { $map: { input: { $split: [{ $ifNull: [field, ''] }, ','] }, as: 'p', in: { $trim: { input: '$$p' } } } } },
    in: {
      $cond: [
        { $gte: [{ $size: '$$parts' }, 3] },
        { $arrayElemAt: ['$$parts', { $subtract: [{ $size: '$$parts' }, 3] }] },
        { $arrayElemAt: ['$$parts', 0] },
      ],
    },
  },
});
