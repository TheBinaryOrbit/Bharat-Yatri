import { KYC_LABEL, RIDE_STATUS_LABEL, titleCase } from '../../lib/format.js';

const TONES = {
  good: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  warn: 'bg-amber-50 text-amber-800 border-amber-100',
  bad: 'bg-red-50 text-red-700 border-red-100',
  info: 'bg-sky-50 text-sky-800 border-sky-100',
  brand: 'bg-brand-soft/25 text-brand-deep border-brand-soft/50',
  navy: 'bg-navy/5 text-navy border-navy/10',
  muted: 'bg-mist text-ink/55 border-line',
};

// Status value → tone, per theme.md §2 mapped onto this backend's enums.
const TONE_OF = {
  completed: 'good', verified: 'good', active: 'good', available: 'good', accepted: 'good', true: 'good', live: 'good', online: 'good',
  searching: 'warn', pending: 'warn', assigned: 'warn', not_started: 'muted', disconnected: 'warn', stale: 'warn',
  cancelled: 'bad', rejected: 'bad', blocked: 'bad', expired: 'muted', inactive: 'muted', false: 'muted', offline: 'muted',
  arriving: 'info', in_progress: 'info', on_trip: 'info', later: 'info', now: 'muted',
  super_admin: 'brand', quickride: 'navy', outstation: 'brand', manual: 'navy', digilocker: 'info', user: 'navy', driver: 'brand',
  android: 'good', ios: 'navy',
};

const LABEL_OF = {
  ...RIDE_STATUS_LABEL,
  ...KYC_LABEL,
  on_trip: 'On a trip',
  quickride: 'Quick ride',
  outstation: 'Outstation',
  digilocker: 'DigiLocker',
  manual: 'Manual',
  user: 'Rider app',
  driver: 'Driver app',
  ios: 'iOS',
  android: 'Android',
  true: 'Yes',
  false: 'No',
};

export function Badge({ tone, children, value, className = '' }) {
  const key = value == null ? undefined : String(value);
  const t = tone || TONE_OF[key] || 'muted';
  const label = children ?? LABEL_OF[key] ?? titleCase(key ?? '');
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${TONES[t]} ${className}`}>
      {label}
    </span>
  );
}
