import { useEffect, useState } from 'react';
import { Plus, Wand2 } from 'lucide-react';
import { api, fieldMap } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { fmtDate, fmtDateTime, titleCase } from '../lib/format.js';
import {
  Badge, Button, Card, CardBody, CardHead, ErrorNote, Field, Input, Modal, PageHead, Pagination, Person, Select, Table, Toggle, Toolbar, useToast,
} from '../components/ui/index.js';

const strongPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  let s = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  if (!/\d/.test(s)) s = `${s.slice(0, -1)}7`;
  if (!/[A-Za-z]/.test(s)) s = `a${s.slice(1)}`;
  return s;
};

const permLabel = (p) => titleCase(p.replace('.', ' · '));

function PasswordField({ value, onChange, error, label = 'Password', hint = '10+ characters, letters and numbers' }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} error={error} autoComplete="new-password" className="font-mono" />
        <Button variant="secondary" onClick={() => onChange(strongPassword())} title="Generate a strong password">
          <Wand2 size={14} /> Generate
        </Button>
      </div>
    </Field>
  );
}

function AdminModal({ open, onClose, initial, roles, onSaved }) {
  const toast = useToast();
  const { admin: me } = useAuth();
  const editing = Boolean(initial);
  const isSelf = editing && String(initial._id) === String(me?._id);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { name: initial.name, role: initial.role, isActive: initial.isActive, password: '' } : { name: '', email: '', role: '', password: '' });
      setError(null);
    }
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const role = roles.find((r) => r.key === form.role);
  const fe = fieldMap(error);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let saved;
      if (editing) {
        const body = {};
        if (form.name !== initial.name) body.name = form.name;
        if (form.role !== initial.role) body.role = form.role;
        if (form.isActive !== initial.isActive) body.isActive = form.isActive;
        if (form.password) body.password = form.password;
        if (!Object.keys(body).length) {
          onClose();
          return;
        }
        saved = await api.patch(`/admins/${initial._id}`, body);
      } else {
        saved = await api.post('/admins', form);
      }
      if (form.password) {
        try {
          await navigator.clipboard.writeText(form.password);
          toast(`${editing ? 'Saved' : 'Admin created'} — password copied to clipboard. Share it privately.`);
        } catch {
          toast(editing ? 'Saved' : 'Admin created');
        }
      } else toast('Saved');
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={editing ? initial.email : 'New admin'}
      title={editing ? `Edit ${initial.name}` : 'Add an admin'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{editing ? 'Save' : 'Create admin'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" error={fe.name}>
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} error={fe.name} />
        </Field>
        {!editing && (
          <Field label="Email" hint="They sign in with this" error={fe.email}>
            <Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} error={fe.email} />
          </Field>
        )}
        <Field label="Role" hint={isSelf ? 'You cannot change your own role' : undefined} error={fe.role}>
          <Select
            value={form.role || ''}
            onChange={(e) => set('role', e.target.value)}
            disabled={isSelf}
            error={fe.role}
            placeholder="Choose a role"
            options={roles.map((r) => ({ value: r.key, label: r.label }))}
          />
        </Field>
        {role && (
          <div className="rounded-md border border-line bg-mist/60 px-3 py-2.5">
            <p className="eyebrow mb-1.5">{role.label} can</p>
            <div className="flex flex-wrap gap-1">
              {role.permissions.map((p) => (
                <Badge key={p} tone="muted">{permLabel(p)}</Badge>
              ))}
            </div>
          </div>
        )}
        <PasswordField
          value={form.password || ''}
          onChange={(v) => set('password', v)}
          error={fe.password}
          label={editing ? 'Reset password' : 'Password'}
          hint={editing ? 'Leave empty to keep it · signs them out' : undefined}
        />
        {editing && (
          <div>
            <Toggle checked={Boolean(form.isActive)} onChange={(v) => set('isActive', v)} disabled={isSelf} label={form.isActive ? 'Can sign in' : 'Deactivated'} />
            {fe.isActive && <p className="mt-1 text-[11px] text-red-600">{fe.isActive}</p>}
            {isSelf && <p className="mt-1 text-[11px] text-ink/45">You cannot deactivate yourself.</p>}
          </div>
        )}
        {error && <ErrorNote error={error} />}
      </div>
    </Modal>
  );
}

export default function AdminUsers() {
  const [f, setF] = useUrlFilters({ q: '', role: '', page: '1', limit: '20' });
  const [q, setQ] = useState(f.q);
  const list = useApi('/admins', { q: f.q, role: f.role, page: f.page, limit: f.limit });
  const rolesRes = useApi('/admins/roles');
  const roles = rolesRes.data?.data || [];
  const [modal, setModal] = useState(null); // 'new' | admin

  useEffect(() => {
    const t = setTimeout(() => q !== f.q && setF({ q }), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = list.data;
  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="Admin users"
        description="Who can sign in to this portal and what each role may do. Every change here is recorded in the audit log."
        action={
          <Button onClick={() => setModal('new')}>
            <Plus size={15} /> Add admin
          </Button>
        }
      />
      <Card className="mb-5">
        <Toolbar>
          <Input className="w-52" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-44" value={f.role} onChange={(e) => setF({ role: e.target.value })} placeholder="Every role" options={roles.map((r) => ({ value: r.key, label: r.label }))} />
        </Toolbar>
        <ErrorNote error={list.error} className="m-4" />
        <Table
          loading={list.loading}
          onRowClick={(a) => setModal(a)}
          columns={[
            { key: 'name', header: 'Admin', render: (a) => <Person name={a.name} sub={a.email} avatar /> },
            { key: 'role', header: 'Role', render: (a) => <Badge value={a.role}>{a.roleLabel}</Badge> },
            { key: 'isActive', header: 'Status', render: (a) => <Badge value={a.isActive ? 'active' : 'inactive'}>{a.isActive ? 'Active' : 'Deactivated'}</Badge> },
            { key: 'lastLoginAt', header: 'Last sign-in', render: (a) => (a.lastLoginAt ? fmtDateTime(a.lastLoginAt) : <span className="text-ink/35">Never</span>) },
            { key: 'createdAt', header: 'Added', render: (a) => <span className="text-ink/60">{fmtDate(a.createdAt)}</span> },
          ]}
          rows={d?.data || []}
        />
        <Pagination page={d?.page || 1} pages={d?.pages || 1} total={d?.total || 0} limit={d?.limit || 20} onPage={(p) => setF({ page: p }, { resetPage: false })} onLimit={(l) => setF({ limit: l })} />
      </Card>
      <Card>
        <CardHead eyebrow="Reference" title="Roles and what they allow" />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.key} className="rounded-md border border-line px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">{r.label}</p>
                <span className="text-[11px] text-ink/45 num">{r.permissions.length} permissions</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <Badge key={p} tone="muted">{permLabel(p)}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
      <AdminModal
        open={Boolean(modal)}
        initial={modal && modal !== 'new' ? modal : null}
        roles={roles}
        onClose={() => setModal(null)}
        onSaved={() => list.reload(true)}
      />
    </>
  );
}
