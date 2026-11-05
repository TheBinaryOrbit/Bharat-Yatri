import { useNavigate } from 'react-router-dom';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtAgo, fmtDateTime } from '../lib/format.js';
import { Badge, Card, EmptyState, ErrorNote, PageHead, Pagination, Person, Select, Table, Tabs, Toolbar } from '../components/ui/index.js';
import { SearchInput } from '../components/people/shared.jsx';

const waitTone = (at) => {
  const h = (Date.now() - new Date(at).getTime()) / 3600000;
  if (h > 48) return 'bad';
  if (h > 12) return 'warn';
  return 'muted';
};

export default function KycQueue() {
  const navigate = useNavigate();
  const [f, set] = useUrlFilters({ status: 'pending', method: 'manual', page: '1', limit: '20' });
  const { data, error, loading } = useApi('/kyc', f);
  const counts = data?.counts || {};
  const pending = f.status === 'pending';

  const columns = [
    { key: 'driver', header: 'Driver', render: (r) => <Person name={r.name} sub={r.phoneNumber} src={r.profileImageUrl} avatar /> },
    { key: 'submitted', header: 'Submitted', render: (r) => fmtDateTime(r.manualKyc?.submittedAt || r.updatedAt) },
    pending && {
      key: 'waiting',
      header: 'Waiting',
      render: (r) => {
        const at = r.manualKyc?.submittedAt || r.updatedAt;
        return <Badge tone={waitTone(at)}>{fmtAgo(at).replace(' ago', '')}</Badge>;
      },
    },
    !pending && { key: 'reviewed', header: 'Reviewed', render: (r) => fmtDateTime(r.manualKyc?.reviewedAt || r.updatedAt) },
    { key: 'method', header: 'Method', render: (r) => (r.kycMethod ? <Badge value={r.kycMethod} /> : '—') },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.kycStatus} /> },
    f.status === 'rejected' && { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-xs truncate text-ink/65" title={r.kycFailedReason}>{r.kycFailedReason || '—'}</span> },
  ].filter(Boolean);

  return (
    <>
      <PageHead
        eyebrow="People"
        title="KYC review"
        description="Drivers who chose manual KYC upload photos of their Aadhaar. Check each one against what they typed, then approve or reject. Oldest requests are first."
      />
      <Card>
        <Toolbar>
          <Tabs
            value={f.status}
            onChange={(status) => set({ status })}
            options={[
              { value: 'pending', label: 'Waiting', count: f.method === 'manual' ? counts.pending ?? 0 : undefined },
              { value: 'verified', label: 'Verified', count: f.method === 'manual' ? counts.verified ?? 0 : undefined },
              { value: 'rejected', label: 'Rejected', count: f.method === 'manual' ? counts.rejected ?? 0 : undefined },
            ]}
          />
          <Select className="w-36" value={f.method} onChange={(e) => set({ method: e.target.value })} options={[{ value: 'manual', label: 'Manual' }, { value: 'digilocker', label: 'DigiLocker' }, { value: 'any', label: 'Any method' }]} />
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Name or phone" className="w-52 lg:ml-auto" />
        </Toolbar>
        {error && <ErrorNote error={error} className="m-4" />}
        <Table
          columns={columns}
          rows={data?.data}
          loading={loading}
          onRowClick={(r) => navigate(`/kyc/${r._id}`)}
          empty={<EmptyState title={pending ? 'All clear' : 'Nothing here'} hint={pending ? 'No KYC requests are waiting for review.' : 'No drivers match.'} />}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={(page) => set({ page }, { resetPage: false })} onLimit={(limit) => set({ limit })} />}
      </Card>
    </>
  );
}
