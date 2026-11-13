import { useNavigate } from 'react-router-dom';
import { useApi, useUrlFilters, useUrlSort } from '../lib/hooks.js';
import { fmtDate } from '../lib/format.js';
import { Button, Card, ErrorNote, ExportButton, PageHead, Pagination, Person, Select, Table, Toolbar } from '../components/ui/index.js';
import { InsuranceBadge, SearchInput } from '../components/people/shared.jsx';

const insuranceText = (e) => (e?.month && e?.year ? `${String(e.month).padStart(2, '0')}/${e.year}` : '');
const EXPORT_COLUMNS = [
  { header: 'Vehicle ID', value: (r) => r._id },
  { header: 'Number', value: (r) => r.vehicleNumber },
  { header: 'Model', value: (r) => r.vehicleName, width: 20 },
  { header: 'Type', value: (r) => r.vehicleTypeId?.name },
  { header: 'Owner', value: (r) => r.ownerName, width: 22 },
  { header: 'Driver', value: (r) => r.driverId?.name, width: 22 },
  { header: 'Driver phone', value: (r) => r.driverId?.phoneNumber },
  { header: 'Seats', value: (r) => r.seatingCapacity, type: 'number' },
  { header: 'Year', value: (r) => r.manufactureYear },
  { header: 'Insurance expiry (MM/YYYY)', value: (r) => insuranceText(r.insuranceExpiry) },
  { header: 'Photos', value: (r) => r.vehicleImages?.length || 0, type: 'number' },
  { header: 'Added', value: (r) => r.createdAt, type: 'datetime' },
];

export default function Vehicles() {
  const navigate = useNavigate();
  const [f, set, clear] = useUrlFilters({ page: '1', limit: '20' });
  const { data, error, loading } = useApi('/vehicles', f);
  const { data: types } = useApi('/vehicle-types');
  const sortProps = useUrlSort(f, set);
  const active = Object.keys(f).some((k) => !['page', 'limit', 'sortBy', 'order'].includes(k));

  const columns = [
    { key: 'number', header: 'Number', sortable: true, render: (r) => <span className="font-medium tracking-wide">{r.vehicleNumber}</span> },
    { key: 'name', header: 'Model', sortable: true, render: (r) => r.vehicleName || <span className="text-ink/35">—</span> },
    { key: 'type', header: 'Type', render: (r) => r.vehicleTypeId?.name || '—' },
    { key: 'owner', header: 'Owner', sortable: true, render: (r) => r.ownerName || <span className="text-ink/35">—</span> },
    {
      key: 'driver',
      header: 'Driver',
      render: (r) => (r.driverId ? <Person name={r.driverId.name} sub={r.driverId.phoneNumber} to={`/drivers/${r.driverId._id}`} /> : <span className="text-ink/35">—</span>),
    },
    { key: 'seats', header: 'Seats', align: 'right', sortable: true, render: (r) => <span className="num">{r.seatingCapacity ?? '—'}</span> },
    { key: 'year', header: 'Year', align: 'right', sortable: true, render: (r) => <span className="num">{r.manufactureYear ?? '—'}</span> },
    { key: 'insurance', header: 'Insurance', sortable: true, render: (r) => <InsuranceBadge expiry={r.insuranceExpiry} /> },
    { key: 'added', header: 'Added', sortable: true, render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Vehicles"
        description="One vehicle per driver, registered during onboarding."
        action={<ExportButton path="/vehicles" params={f} columns={EXPORT_COLUMNS} filename="vehicles" sheet="Vehicles" />}
      />
      <Card>
        <Toolbar>
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Number, model or owner" />
          <Select className="w-40" value={f.vehicleTypeId || ''} onChange={(e) => set({ vehicleTypeId: e.target.value })} placeholder="Any vehicle type" options={(types?.data || []).map((t) => ({ value: t._id, label: t.name }))} />
          <Select className="w-48" value={f.insurance || ''} onChange={(e) => set({ insurance: e.target.value })} placeholder="Any insurance" options={[{ value: 'expired', label: 'Insurance expired' }, { value: 'expiring', label: 'Expiring this / next month' }]} />
          {active && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
        </Toolbar>
        {error && <ErrorNote error={error} className="m-4" />}
        <Table {...sortProps} columns={columns} rows={data?.data} loading={loading} onRowClick={(r) => navigate(`/vehicles/${r._id}`)} minWidth="min-w-[960px]" />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={(page) => set({ page }, { resetPage: false })} onLimit={(limit) => set({ limit })} />}
      </Card>
    </>
  );
}
