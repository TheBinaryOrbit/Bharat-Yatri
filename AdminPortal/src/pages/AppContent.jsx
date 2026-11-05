import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtDateTime } from '../lib/format.js';
import { Badge, Button, Card, Confirm, EmptyState, ErrorNote, PageHead, Table, Tabs, Toolbar, useToast } from '../components/ui/index.js';

export default function AppContent() {
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters] = useUrlFilters({ type: '' });
  const { data, error, loading, reload } = useApi('/app-content');
  const [removing, setRemoving] = useState(null);

  const all = data?.data || [];
  const rows = filters.type ? all.filter((p) => p.type === filters.type) : all;
  const count = (t) => all.filter((p) => p.type === t).length;

  const columns = [
    { key: 'name', header: 'Page', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'slug', header: 'Slug', render: (p) => <code className="text-xs text-ink/60">{p.slug}</code> },
    { key: 'type', header: 'App', render: (p) => <Badge value={p.type} /> },
    { key: 'iconName', header: 'Icon', render: (p) => (p.iconName ? <span className="text-xs text-ink/55">{p.iconName}</span> : <span className="text-ink/35">—</span>) },
    { key: 'isActive', header: 'Status', render: (p) => <Badge value={p.isActive ? 'active' : 'inactive'}>{p.isActive ? 'Live' : 'Hidden'}</Badge> },
    { key: 'updatedAt', header: 'Updated', render: (p) => <span className="text-ink/60">{fmtDateTime(p.updatedAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${p.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setRemoving(p);
          }}
        >
          <Trash2 size={14} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Configuration"
        title="App content"
        description="Terms, privacy policy and other pages the rider and driver apps load at runtime. Only live pages appear in the apps."
        action={
          <Button onClick={() => navigate('/app-content/new')}>
            <Plus size={15} /> New page
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <Tabs
            value={filters.type}
            onChange={(type) => setFilters({ type })}
            options={[
              { value: '', label: 'All', count: all.length },
              { value: 'user', label: 'Rider app', count: count('user') },
              { value: 'driver', label: 'Driver app', count: count('driver') },
            ]}
          />
        </Toolbar>
        <ErrorNote error={error} className="m-4" />
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          onRowClick={(p) => navigate(`/app-content/${p._id}`)}
          empty={<EmptyState title="No pages yet" hint="Create the Terms & Conditions or Privacy Policy page to get started." />}
        />
      </Card>
      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Delete “${removing?.name}”?`}
        confirmLabel="Delete page"
        onConfirm={async () => {
          await api.del(`/app-content/${removing._id}`);
          toast('Page deleted');
          reload(true);
        }}
      >
        The {removing?.type === 'driver' ? 'driver' : 'rider'} app will no longer be able to open <code>{removing?.slug}</code>. To hide it temporarily,
        switch it off in the editor instead.
      </Confirm>
    </>
  );
}
