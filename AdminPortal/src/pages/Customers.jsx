import { useNavigate } from 'react-router-dom';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtDate, fmtNumber } from '../lib/format.js';
import { Button, Card, DateRange, ErrorNote, PageHead, Pagination, Person, Select, Table, Toolbar } from '../components/ui/index.js';
import { AccountStatus, SearchInput } from '../components/people/shared.jsx';

export default function Customers() {
  const navigate = useNavigate();
  const [f, set, clear] = useUrlFilters({ page: '1', limit: '20' });
  const { data, error, loading } = useApi('/customers', f);
  const active = Object.keys(f).some((k) => !['page', 'limit'].includes(k));

  const columns = [
    { key: 'name', header: 'Customer', render: (r) => <Person name={r.name} sub={r.phoneNumber} src={r.profileImageUrl} avatar /> },
    { key: 'joined', header: 'Joined', render: (r) => fmtDate(r.createdAt) },
    { key: 'quick', header: 'Quick rides', align: 'right', render: (r) => <span className="num">{fmtNumber(r.quickRides)}</span> },
    { key: 'out', header: 'Outstation', align: 'right', render: (r) => <span className="num">{fmtNumber(r.outstationRides)}</span> },
    { key: 'last', header: 'Last ride', render: (r) => (r.lastRideAt ? fmtDate(r.lastRideAt) : <span className="text-ink/35">—</span>) },
    { key: 'status', header: 'Status', render: (r) => <AccountStatus blocked={r.isBlocked} /> },
  ];

  return (
    <>
      <PageHead eyebrow="People" title="Customers" description="Everyone who has signed up in the rider app. Open a customer to see their rides, saved places and reviews." />
      <Card>
        <Toolbar>
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Name, phone or ID" />
          <Select className="w-36" value={f.blocked || ''} onChange={(e) => set({ blocked: e.target.value })} placeholder="Any status" options={[{ value: 'false', label: 'Active' }, { value: 'true', label: 'Blocked' }]} />
          <Select className="w-40" value={f.hasRides || ''} onChange={(e) => set({ hasRides: e.target.value })} placeholder="With or without rides" options={[{ value: 'true', label: 'Has booked rides' }, { value: 'false', label: 'Never booked' }]} />
          <Select className="w-32" value={f.sort || ''} onChange={(e) => set({ sort: e.target.value })} placeholder="Newest first" options={[{ value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name A–Z' }]} />
          <span className="text-xs text-ink/50 lg:ml-auto">Joined</span>
          <DateRange from={f.from} to={f.to} onChange={({ from, to }) => set({ from, to })} presets={false} />
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          )}
        </Toolbar>
        {error && <ErrorNote error={error} className="m-4" />}
        <Table columns={columns} rows={data?.data} loading={loading} onRowClick={(r) => navigate(`/customers/${r._id}`)} />
        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={(page) => set({ page }, { resetPage: false })} onLimit={(limit) => set({ limit })} />
        )}
      </Card>
    </>
  );
}
