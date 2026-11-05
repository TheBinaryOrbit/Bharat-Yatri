import { useNavigate } from 'react-router-dom';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtDate, fmtNumber, KYC_LABEL } from '../lib/format.js';
import { Badge, Button, Card, DateRange, ErrorNote, PageHead, Pagination, Person, Select, Stars, Table, Toolbar } from '../components/ui/index.js';
import { AccountStatus, SearchInput } from '../components/people/shared.jsx';

export default function Drivers() {
  const navigate = useNavigate();
  const [f, set, clear] = useUrlFilters({ page: '1', limit: '20' });
  const { data, error, loading } = useApi('/drivers', f);
  const { data: types } = useApi('/vehicle-types');
  const active = Object.keys(f).some((k) => !['page', 'limit'].includes(k));

  const columns = [
    { key: 'name', header: 'Driver', render: (r) => <Person name={r.name} sub={r.phoneNumber} src={r.profileImageUrl} avatar /> },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (r) =>
        r.vehicle ? (
          <span>
            <span className="block font-medium">{r.vehicle.vehicleNumber}</span>
            <span className="block text-xs text-ink/50">{r.vehicle.vehicleType || r.vehicle.vehicleName || '—'}</span>
          </span>
        ) : (
          <span className="text-ink/35">None yet</span>
        ),
    },
    {
      key: 'kyc',
      header: 'KYC',
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Badge value={r.kycStatus || 'not_started'} />
          {r.kycMethod && <span className="text-[11px] text-ink/45">{r.kycMethod === 'digilocker' ? 'DigiLocker' : 'Manual'}</span>}
        </span>
      ),
    },
    {
      key: 'onboarding',
      header: 'Onboarding',
      render: (r) =>
        r.onboarding?.isComplete ? (
          <Badge tone="good">Complete</Badge>
        ) : (
          <span className="text-sm num text-ink/65">
            {r.onboarding?.completedStep ?? 0}/{r.onboarding?.totalSteps ?? 3}
          </span>
        ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) =>
        r.rating?.count ? (
          <span className="whitespace-nowrap">
            <Stars value={r.rating.average} /> <span className="text-xs text-ink/45 num">({fmtNumber(r.rating.count)})</span>
          </span>
        ) : (
          <span className="text-ink/35">No reviews</span>
        ),
    },
    { key: 'done', header: 'Completed rides', align: 'right', render: (r) => <span className="num">{fmtNumber(r.completedRides)}</span> },
    { key: 'joined', header: 'Joined', render: (r) => fmtDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <AccountStatus blocked={r.isBlocked} /> },
  ];

  return (
    <>
      <PageHead eyebrow="People" title="Drivers" description="Every driver account, from first OTP to fully verified. Ratings come from rider reviews." />
      <Card>
        <Toolbar>
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Name, phone or vehicle no." />
          <Select className="w-36" value={f.kycStatus || ''} onChange={(e) => set({ kycStatus: e.target.value })} placeholder="Any KYC" options={Object.entries(KYC_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select className="w-32" value={f.kycMethod || ''} onChange={(e) => set({ kycMethod: e.target.value })} placeholder="Any method" options={[{ value: 'manual', label: 'Manual' }, { value: 'digilocker', label: 'DigiLocker' }]} />
          <Select className="w-40" value={f.onboarding || ''} onChange={(e) => set({ onboarding: e.target.value })} placeholder="Any onboarding" options={[{ value: 'complete', label: 'Onboarding complete' }, { value: 'incomplete', label: 'Still onboarding' }]} />
          <Select className="w-36" value={f.vehicleTypeId || ''} onChange={(e) => set({ vehicleTypeId: e.target.value })} placeholder="Any vehicle" options={(types?.data || []).map((t) => ({ value: t._id, label: t.name }))} />
          <Select className="w-32" value={f.blocked || ''} onChange={(e) => set({ blocked: e.target.value })} placeholder="Any status" options={[{ value: 'false', label: 'Active' }, { value: 'true', label: 'Blocked' }]} />
          <span className="text-xs text-ink/50 lg:ml-auto">Joined</span>
          <DateRange from={f.from} to={f.to} onChange={({ from, to }) => set({ from, to })} presets={false} />
          {active && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
        </Toolbar>
        {error && <ErrorNote error={error} className="m-4" />}
        <Table columns={columns} rows={data?.data} loading={loading} onRowClick={(r) => navigate(`/drivers/${r._id}`)} minWidth="min-w-[960px]" />
        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={(page) => set({ page }, { resetPage: false })} onLimit={(limit) => set({ limit })} />
        )}
      </Card>
    </>
  );
}
