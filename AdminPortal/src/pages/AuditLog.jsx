import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtDateTime, shortId, titleCase } from '../lib/format.js';
import { Badge, Card, DateRange, ErrorNote, Input, KeyValues, Modal, PageHead, Pagination, Select, Table, Toolbar } from '../components/ui/index.js';

const ENTITIES = [
  ['driver', 'Driver'],
  ['user', 'Customer'],
  ['vehicle', 'Vehicle'],
  ['vehicleType', 'Vehicle type'],
  ['setting', 'App settings'],
  ['appContent', 'App content'],
  ['review', 'Review'],
  ['quickride', 'Quick ride'],
  ['outstation', 'Outstation ride'],
  ['admin', 'Admin user'],
];
const ENTITY_LABEL = Object.fromEntries(ENTITIES);

const LINK = {
  driver: (id) => `/drivers/${id}`,
  user: (id) => `/customers/${id}`,
  vehicle: (id) => `/vehicles/${id}`,
  quickride: (id) => `/quick-rides/${id}`,
  outstation: (id) => `/outstation-rides/${id}`,
  appContent: (id) => `/app-content/${id}`,
};

const toneOf = (action = '') => {
  if (/block$|reject|remove|delete|mandatory_update_on/.test(action)) return 'bad';
  if (/unblock|approve|create/.test(action)) return 'good';
  if (/pricing/.test(action)) return 'brand';
  return 'navy';
};

const pretty = (v) => {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

function Diff({ before, after }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  if (!keys.length) return <p className="text-sm text-ink/45">No field values were recorded for this action.</p>;
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid grid-cols-[9rem_1fr_1fr] border-b border-line bg-mist/70 text-eyebrow font-medium uppercase text-ink/50">
        <span className="px-3 py-2">Field</span>
        <span className="px-3 py-2">Before</span>
        <span className="px-3 py-2">After</span>
      </div>
      {keys.map((k) => {
        const b = before?.[k];
        const a = after?.[k];
        const changed = JSON.stringify(b) !== JSON.stringify(a);
        return (
          <div key={k} className={`grid grid-cols-[9rem_1fr_1fr] border-b border-line/60 text-[12px] last:border-0 ${changed ? 'bg-brand-soft/10' : ''}`}>
            <span className={`px-3 py-2 ${changed ? 'font-medium text-ink' : 'text-ink/55'}`}>{k}</span>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-ink/55">{pretty(b)}</pre>
            <pre className={`max-h-48 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono ${changed ? 'text-ink' : 'text-ink/55'}`}>{pretty(a)}</pre>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLog() {
  const { can } = useAuth();
  const [f, setF] = useUrlFilters({ action: '', entity: '', entityId: '', adminId: '', from: '', to: '', page: '1', limit: '50' });
  const [action, setAction] = useState(f.action);
  const [open, setOpen] = useState(null);
  const list = useApi('/audit-logs', f);
  const admins = useApi('/admins', { limit: 100 }, { enabled: can('admins.manage') });

  useEffect(() => {
    const t = setTimeout(() => action !== f.action && setF({ action }), 350);
    return () => clearTimeout(t);
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = list.data;
  const entityCell = (r) => {
    const label = ENTITY_LABEL[r.entity] || r.entity;
    const to = r.entityId && LINK[r.entity]?.(r.entityId);
    return (
      <span className="whitespace-nowrap">
        {label}{' '}
        {r.entityId &&
          (to ? (
            <Link to={to} onClick={(e) => e.stopPropagation()} className="text-brand hover:text-brand-deep num">
              {/^[a-f0-9]{24}$/i.test(r.entityId) ? shortId(r.entityId) : r.entityId}
            </Link>
          ) : (
            <span className="text-ink/50 num">{/^[a-f0-9]{24}$/i.test(r.entityId) ? shortId(r.entityId) : r.entityId}</span>
          ))}
      </span>
    );
  };

  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="Audit log"
        description="Every change made through this portal — who, when, what it was before and after, and why. Entries cannot be edited or removed."
      />
      <Card>
        <Toolbar>
          <Input className="w-52" placeholder="Action, e.g. kyc or block" value={action} onChange={(e) => setAction(e.target.value)} />
          <Select className="w-40" value={f.entity} onChange={(e) => setF({ entity: e.target.value })} placeholder="Every record type" options={ENTITIES.map(([value, label]) => ({ value, label }))} />
          {can('admins.manage') && (
            <Select
              className="w-44"
              value={f.adminId}
              onChange={(e) => setF({ adminId: e.target.value })}
              placeholder="Every admin"
              options={(admins.data?.data || []).map((a) => ({ value: a._id, label: a.name }))}
            />
          )}
          {f.entityId && (
            <button onClick={() => setF({ entityId: '' })} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink/60 hover:text-brand">
              Record {shortId(f.entityId)} ✕
            </button>
          )}
          <DateRange from={f.from} to={f.to} onChange={({ from, to }) => setF({ from, to })} className="ml-auto" />
        </Toolbar>
        <ErrorNote error={list.error} className="m-4" />
        <Table
          loading={list.loading}
          onRowClick={setOpen}
          columns={[
            { key: 'createdAt', header: 'When', render: (r) => <span className="whitespace-nowrap text-ink/70">{fmtDateTime(r.createdAt)}</span> },
            {
              key: 'admin',
              header: 'Admin',
              render: (r) => (
                <span>
                  <span className="block font-medium">{r.adminName || 'Admin'}</span>
                  <span className="block text-xs text-ink/50">{titleCase(r.adminRole || '')}</span>
                </span>
              ),
            },
            { key: 'action', header: 'Action', render: (r) => <Badge tone={toneOf(r.action)}>{r.action}</Badge> },
            { key: 'entity', header: 'Record', render: entityCell },
            { key: 'reason', header: 'Reason', tdClassName: 'max-w-xs', render: (r) => (r.reason ? <span className="line-clamp-2 text-ink/70">{r.reason}</span> : <span className="text-ink/35">—</span>) },
          ]}
          rows={d?.data || []}
        />
        <Pagination page={d?.page || 1} pages={d?.pages || 1} total={d?.total || 0} limit={d?.limit || 50} onPage={(p) => setF({ page: p }, { resetPage: false })} onLimit={(l) => setF({ limit: l })} />
      </Card>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} eyebrow={open && fmtDateTime(open.createdAt)} title={open?.action || ''} width="max-w-3xl">
        {open && (
          <div className="space-y-4">
            <KeyValues
              items={[
                ['Admin', `${open.adminName || 'Admin'} · ${titleCase(open.adminRole || '')}`],
                ['Record', entityCell(open)],
                ['Reason', open.reason || ''],
                ['IP address', open.ip || ''],
              ]}
            />
            <Diff before={open.before} after={open.after} />
          </div>
        )}
      </Modal>
    </>
  );
}
