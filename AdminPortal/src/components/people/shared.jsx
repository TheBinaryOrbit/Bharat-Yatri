import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ShieldAlert, ShieldCheck, Ban } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useDebounced } from '../../lib/hooks.js';
import { fmtDate, fmtDateTime, fmtMoney, shortId } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { Badge, Button, Confirm, Input, Pagination, Person, Table, Tabs, useToast } from '../ui/index.js';

// Search box that writes to the URL filter after a short pause.
export function SearchInput({ value, onChange, placeholder = 'Search', className = 'w-52' }) {
  const [text, setText] = useState(value || '');
  const debounced = useDebounced(text);
  useEffect(() => {
    if ((debounced || '') !== (value || '')) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => {
    setText(value || '');
  }, [value]);
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

export function BackLink({ to, children }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(to))}
      className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-brand"
    >
      <ArrowLeft size={13} /> {children}
    </button>
  );
}

export function AccountStatus({ blocked }) {
  return blocked ? <Badge tone="bad">Blocked</Badge> : <Badge tone="good">Active</Badge>;
}

export function BlockedBanner({ reason, at, who = 'account' }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">This {who} is blocked{at ? ` since ${fmtDateTime(at)}` : ''}.</p>
        <p className="mt-0.5 text-red-700/80">
          They cannot sign in, use the app or connect. {reason ? <>Reason: “{reason}”</> : null}
        </p>
      </div>
    </div>
  );
}

// Block / unblock button with a required reason. kind: 'customers' | 'drivers'.
export function BlockAction({ kind, id, blocked, name, onDone, extraWarning }) {
  const { can } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!can('people.block')) return null;
  const label = kind === 'drivers' ? 'driver' : 'customer';

  return (
    <>
      <Button variant={blocked ? 'secondary' : 'danger'} onClick={() => setOpen(true)}>
        {blocked ? <ShieldCheck size={15} /> : <Ban size={15} />}
        {blocked ? 'Unblock' : 'Block'}
      </Button>
      <Confirm
        open={open}
        onClose={() => setOpen(false)}
        title={blocked ? `Unblock ${name || label}?` : `Block ${name || label}?`}
        confirmLabel={blocked ? 'Unblock' : 'Block account'}
        tone={blocked ? 'primary' : 'danger'}
        reason
        reasonPlaceholder={blocked ? 'Why access is being restored' : 'What happened — shown to the account holder'}
        onConfirm={async (reason) => {
          const d = await api.patch(`/${kind}/${id}/block`, { blocked: !blocked, reason });
          toast(d.message);
          onDone?.();
        }}
      >
        {blocked ? (
          <p>They will be able to sign in and use the app again.</p>
        ) : (
          <>
            <p>
              The {label} is signed out straight away and refused at login, on every API call and on socket connect
              {kind === 'drivers' ? ', and taken offline so no new rides are sent to them' : ''}.
            </p>
            {extraWarning}
          </>
        )}
      </Confirm>
    </>
  );
}

// Ride history for one customer or driver, Quick / Outstation tabs.
export function RideHistory({ filterKey, id, showCustomer = false, showDriver = false }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState('quickride');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const path = kind === 'quickride' ? '/quick-rides' : '/outstation-rides';
  const { data, loading } = useApi(path, { [filterKey]: id, page, limit: 10, sortBy: sort?.by, order: sort?.order });
  const base = kind === 'quickride' ? '/quick-rides' : '/outstation-rides';

  const columns = [
    { key: 'id', header: 'Ride', render: (r) => <span className="font-medium">{shortId(r._id)}</span> },
    { key: 'when', sortKey: kind === 'outstation' ? 'pickupAt' : 'ride', header: kind === 'outstation' ? 'Trip date' : 'Booked', sortable: true, render: (r) => fmtDateTime(kind === 'outstation' ? r.pickupAt : r.createdAt) },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <span className="block max-w-[18rem]">
          <span className="block truncate">{r.pickupLocationName}</span>
          <span className="block truncate text-xs text-ink/50">→ {r.dropLocationName}</span>
        </span>
      ),
    },
    showCustomer && { key: 'customer', header: 'Customer', render: (r) => <Person name={r.bookedBy?.name} sub={r.bookedBy?.phoneNumber} /> },
    showDriver && { key: 'driver', header: 'Driver', render: (r) => (r.assignedTo ? <Person name={r.assignedTo.name} sub={r.assignedTo.phoneNumber} /> : <span className="text-ink/35">—</span>) },
    { key: 'type', header: 'Vehicle', render: (r) => r.vehicleTypeId?.name || '—' },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge value={r.rideStatus} /> },
    { key: 'fare', header: 'Fare', align: 'right', sortable: true, render: (r) => fmtMoney(r.finalFare ?? r.offeredFare) },
  ].filter(Boolean);

  return (
    <div>
      <div className="px-5 pt-4">
        <Tabs
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
            setSort(null);
          }}
          options={[
            { value: 'quickride', label: 'Quick rides' },
            { value: 'outstation', label: 'Outstation' },
          ]}
        />
      </div>
      <div className="mt-3">
        <Table sort={sort} onSort={(s) => { setSort(s); setPage(1); }} columns={columns} rows={data?.data} loading={loading} onRowClick={(r) => navigate(`${base}/${r._id}`)} minWidth="min-w-[640px]" />
        {data && data.total > 10 && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />}
      </div>
    </div>
  );
}

// Insurance expiry {month, year} → badge.
export function InsuranceBadge({ expiry }) {
  if (!expiry?.month || !expiry?.year) return <span className="text-ink/35">—</span>;
  const now = new Date();
  const cur = now.getFullYear() * 12 + now.getMonth();
  const exp = expiry.year * 12 + (expiry.month - 1);
  const label = new Date(expiry.year, expiry.month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  if (exp < cur) return <Badge tone="bad">Expired {label}</Badge>;
  if (exp <= cur + 1) return <Badge tone="warn">Expires {label}</Badge>;
  return <Badge tone="muted">{label}</Badge>;
}

export const yesNoOptions = (yes, no) => [
  { value: 'true', label: yes },
  { value: 'false', label: no },
];

export const DateCell = ({ value }) => <span className="whitespace-nowrap">{fmtDate(value)}</span>;

export const osmLink = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

export function RideLink({ type, id }) {
  return (
    <Link to={`${type === 'outstation' ? '/outstation-rides' : '/quick-rides'}/${id}`} className="text-brand hover:text-brand-deep">
      {shortId(id)}
    </Link>
  );
}
