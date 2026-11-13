import { useState } from 'react';
import { Car, ListChecks, LogIn, ShieldCheck, UserCog, UserPlus, Wrench } from 'lucide-react';
import { useApi } from '../../lib/hooks.js';
import { fmtAgo, fmtDateTime, titleCase } from '../../lib/format.js';
import { Badge, Card, CardHead, DateRange, DocThumb, EmptyState, ErrorNote, ExportButton, Pagination, Select, Spinner, Toolbar } from '../ui/index.js';

// A driver's timeline: sign-ins, each onboarding step with the documents uploaded, KYC attempts
// and what admins did to the account. Backed by GET /admin/drivers/:id/activity.

const CATEGORIES = [
  { value: 'auth', label: 'Sign-ins' },
  { value: 'account', label: 'Account' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'kyc', label: 'KYC' },
  { value: 'profile', label: 'Profile edits' },
  { value: 'vehicle', label: 'Vehicle edits' },
  { value: 'admin', label: 'Admin actions' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const ICONS = { auth: LogIn, account: UserPlus, onboarding: ListChecks, kyc: ShieldCheck, profile: UserCog, vehicle: Car, admin: Wrench };

const FIELD_LABELS = {
  name: 'Name', email: 'Email', dob: 'Date of birth', gender: 'Gender', address: 'Address', aadharCardNumber: 'Aadhaar number',
  dlNumber: 'DL number', vehicleTypeId: 'Vehicle type', vehicleNumber: 'Vehicle number', vehicleName: 'Model', ownerName: 'Owner',
  seatingCapacity: 'Seats', manufactureYear: 'Year', insuranceExpiryMonth: 'Insurance month', insuranceExpiryYear: 'Insurance year',
};
const fieldLabel = (f) => FIELD_LABELS[f] || titleCase(f);

const isFailure = (type) => /_failed$|login_blocked$|kyc_rejected$|\.blocked$/.test(type);
const isSuccess = (type) => /verified$|approved$|completed$|onboarding\.vehicle$|onboarding\.full$|unblocked$/.test(type);

const toneOf = (a) => (isFailure(a.type) ? 'bad' : isSuccess(a.type) ? 'good' : a.category === 'admin' ? 'navy' : 'muted');

const ICON_TONE = {
  bad: 'bg-red-50 text-red-600 border-red-100',
  good: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  navy: 'bg-navy/5 text-navy border-navy/10',
  muted: 'bg-mist text-ink/55 border-line',
};

const actorText = (a) => {
  if (a.actor?.kind === 'admin') return `by ${a.actor.name || 'an admin'}`;
  if (a.actor?.kind === 'system') return a.actor.name ? `by ${a.actor.name}` : 'by the system';
  return 'by the driver';
};

// Plain-language lines for the type-specific extras.
const detailLines = (a) => {
  const m = a.meta || {};
  const out = [];
  if (a.type === 'auth.login' && m.onboardingStep != null) {
    out.push(m.onboardingComplete ? 'Onboarding was complete at sign-in' : `Onboarding at step ${m.onboardingStep} of 3 at sign-in`);
  }
  if (m.vehicleNumber) out.push(`Vehicle ${m.vehicleNumber}${m.vehicleType ? ` (${m.vehicleType})` : ''}`);
  if (m.resubmitted) out.push('Re-submitted — replaces what was saved before');
  if (m.usedExistingVehicle) out.push('A vehicle was already on file, so the files sent in this step were not saved');
  if (m.from || m.to) out.push(`KYC: ${titleCase(m.from || '—')} → ${titleCase(m.to || 'verified')}`);
  if (m.missingDocuments?.length) out.push(`Completed without: ${m.missingDocuments.join(', ')}`);
  if (m.received?.length) out.push(`Files received: ${m.received.join(', ')}`);
  if (m.statusKept) out.push('The existing KYC status was kept');
  if (m.errors?.length) out.push(`Problems: ${m.errors.map((e) => e.message).join('; ')}`);
  if (m.reason) out.push(`Reason: “${m.reason}”`);
  return out;
};

const EXPORT_COLUMNS = [
  { header: 'When', value: (a) => a.createdAt, type: 'datetime' },
  { header: 'Activity', value: (a) => a.title, width: 44 },
  { header: 'Category', value: (a) => CATEGORY_LABEL[a.category] || a.category },
  { header: 'Done', value: (a) => actorText(a).replace(/^by /, ''), width: 20 },
  { header: 'Uploaded', value: (a) => (a.uploads || []).map((u) => u.label), width: 32 },
  { header: 'Upload links', value: (a) => (a.uploads || []).map((u) => u.url).join('\n'), width: 50 },
  { header: 'Fields sent', value: (a) => (a.fields || []).map(fieldLabel), width: 30 },
  { header: 'Details', value: (a) => detailLines(a).join(' · '), width: 50 },
  { header: 'IP address', value: (a) => a.ip },
  { header: 'Device', value: (a) => a.userAgent, width: 30 },
  { header: 'Type', value: (a) => a.type, width: 24 },
];

function ActivityItem({ a }) {
  const Icon = ICONS[a.category] || ListChecks;
  const tone = toneOf(a);
  const lines = detailLines(a);
  return (
    <li className="relative flex gap-4 px-5 py-4">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ICON_TONE[tone]}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-medium">{a.title}</p>
          <p className="whitespace-nowrap text-xs text-ink/50" title={fmtAgo(a.createdAt)}>
            {fmtDateTime(a.createdAt)}
          </p>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/50">
          <Badge tone={tone === 'muted' ? 'muted' : tone}>{CATEGORY_LABEL[a.category] || a.category}</Badge>
          <span>{actorText(a)}</span>
          <span className="text-ink/35">· {fmtAgo(a.createdAt)}</span>
        </p>
        {a.fields?.length > 0 && (
          <p className="mt-2 text-xs text-ink/65">
            <span className="text-ink/45">Fields sent: </span>
            {a.fields.map(fieldLabel).join(', ')}
          </p>
        )}
        {lines.length > 0 && (
          <ul className={`mt-2 space-y-0.5 text-xs ${tone === 'bad' ? 'text-red-700' : 'text-ink/65'}`}>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {a.uploads?.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-ink/45">
              Uploaded {a.uploads.length} file{a.uploads.length === 1 ? '' : 's'}
            </p>
            <div className="grid max-w-xl grid-cols-3 gap-2 sm:grid-cols-4">
              {a.uploads.map((u) => (
                <DocThumb key={u.url} label={u.label} src={u.url} />
              ))}
            </div>
          </div>
        )}
        {(a.ip || a.userAgent) && (
          <p className="mt-2 truncate text-[11px] text-ink/35" title={a.userAgent}>
            {[a.ip && `IP ${a.ip}`, a.userAgent].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </li>
  );
}

export function DriverActivity({ driverId, driverName }) {
  const [category, setCategory] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const filters = { category, from: range.from, to: range.to };
  const { data, loading, error } = useApi(`/drivers/${driverId}/activity`, { ...filters, page, limit: 20 });
  const filtered = Boolean(category || range.from || range.to);
  const slug = (driverName || 'driver').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'driver';

  return (
    <Card>
      <CardHead
        eyebrow="Activity"
        title="What this driver did, and when"
        action={<ExportButton path={`/drivers/${driverId}/activity`} params={filters} columns={EXPORT_COLUMNS} filename={`activity-${slug}`} sheet="Activity" size="sm" />}
      />
      <Toolbar>
        <Select
          className="w-44"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          placeholder="Everything"
          options={CATEGORIES}
        />
        <DateRange
          from={range.from}
          to={range.to}
          onChange={(r) => {
            setRange({ from: r.from || '', to: r.to || '' });
            setPage(1);
          }}
          className="lg:ml-auto"
        />
      </Toolbar>
      {error && <ErrorNote error={error} className="m-4" />}
      {loading && !data ? (
        <Spinner />
      ) : data?.data?.length ? (
        <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
          {data.data.map((a) => (
            <ActivityItem key={a._id} a={a} />
          ))}
        </ul>
      ) : (
        <div className="py-14">
          <EmptyState
            title={filtered ? 'No activity matches' : 'No activity recorded yet'}
            hint={filtered ? 'Try another category or a wider date range.' : 'Sign-ins, onboarding steps, uploads and KYC attempts appear here from now on.'}
          />
        </div>
      )}
      {data && data.total > 20 && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />}
    </Card>
  );
}
