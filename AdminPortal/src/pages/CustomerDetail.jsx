import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Pencil } from 'lucide-react';
import { api, fieldMap } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, shortId } from '../lib/format.js';
import {
  Avatar, Button, Card, CardBody, CardHead, ErrorNote, Field, Input, KeyValues, Modal, NotesPanel, PageHead, Select, Spinner, StatCard, StatRow, Stars,
  useListSort, useToast,
} from '../components/ui/index.js';
import { AccountStatus, BackLink, BlockAction, BlockedBanner, RideHistory, osmLink } from '../components/people/shared.jsx';

function EditProfile({ open, onClose, customer, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: customer.name || '', title: customer.title || '', sosContact: customer.sosContact || '' });
      setError(null);
    }
  }, [open, customer]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/customers/${customer._id}`, form);
      toast('Profile updated');
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const fe = fieldMap(error);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Customer"
      title="Edit profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" hint="e.g. Mr, Ms" error={fe.title}>
          <Input value={form.title || ''} onChange={set('title')} error={fe.title} />
        </Field>
        <Field label="Name" error={fe.name}>
          <Input value={form.name || ''} onChange={set('name')} error={fe.name} />
        </Field>
        <Field label="SOS contact" hint="10 digits, optional" error={fe.sosContact} className="sm:col-span-2">
          <Input value={form.sosContact || ''} onChange={set('sosContact')} inputMode="numeric" maxLength={10} error={fe.sosContact} />
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-ink/45">The phone number is the login and can’t be changed here. Changes are recorded in the audit log.</p>
      {error && !error.fieldErrors?.length && <ErrorNote error={error} className="mt-3" />}
    </Modal>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi(`/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [destinations, destSort] = useListSort(data?.destinations, [
    { value: 'newest', label: 'Newest first', by: (d) => d.createdAt, order: 'desc' },
    { value: 'oldest', label: 'Oldest first', by: (d) => d.createdAt, order: 'asc' },
    { value: 'name', label: 'Name A–Z', by: (d) => d.tag, order: 'asc' },
  ]);
  const [reviews, reviewSort] = useListSort(data?.reviews, [
    { value: 'newest', label: 'Newest first', by: (r) => r.createdAt, order: 'desc' },
    { value: 'oldest', label: 'Oldest first', by: (r) => r.createdAt, order: 'asc' },
    { value: 'highest', label: 'Highest rating', by: (r) => r.rating, order: 'desc' },
    { value: 'lowest', label: 'Lowest rating', by: (r) => r.rating, order: 'asc' },
  ]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const { customer: c, rides } = data;

  return (
    <>
      <BackLink to="/customers">Customers</BackLink>
      <PageHead
        eyebrow="Customer"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} src={c.profileImageUrl} size="h-10 w-10" />
            {c.title ? `${c.title} ` : ''}
            {c.name}
          </span>
        }
        description={`Joined ${fmtDate(c.createdAt)} · ${shortId(c._id)}`}
        action={
          <>
            {can('people.edit') && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit profile
              </Button>
            )}
            <BlockAction kind="customers" id={c._id} blocked={c.isBlocked} name={c.name} onDone={reload}
              extraWarning={rides.active > 0 ? <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">They have {rides.active} active ride(s). Blocking does not cancel them.</p> : null}
            />
          </>
        }
      />
      {c.isBlocked && <BlockedBanner reason={c.blockedReason} at={c.blockedAt} who="customer" />}

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <StatCard eyebrow="Quick rides" value={fmtNumber(rides.quick.total)} caption="booked, all time">
          <StatRow label="Completed" value={fmtNumber(rides.quick.byStatus.completed || 0)} />
          <StatRow label="Cancelled" value={fmtNumber(rides.quick.byStatus.cancelled || 0)} />
          <StatRow label="Ride value (completed)" value={fmtMoney(rides.quick.completedValue)} />
        </StatCard>
        <StatCard eyebrow="Outstation rides" value={fmtNumber(rides.outstation.total)} caption="booked, all time">
          <StatRow label="Completed" value={fmtNumber(rides.outstation.byStatus.completed || 0)} />
          <StatRow label="Cancelled" value={fmtNumber(rides.outstation.byStatus.cancelled || 0)} />
          <StatRow label="Ride value (completed)" value={fmtMoney(rides.outstation.completedValue)} />
        </StatCard>
        <StatCard eyebrow="Right now" value={fmtNumber(rides.active)} caption="active rides" tone={rides.active ? 'brand' : undefined}>
          <StatRow label="Saved places" value={fmtNumber(destinations.length)} />
          <StatRow label="Reviews written" value={fmtNumber(reviews.length)} />
        </StatCard>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead eyebrow="Profile" title="Details" action={<AccountStatus blocked={c.isBlocked} />} />
          <CardBody>
            <KeyValues
              items={[
                ['Title', c.title],
                ['Name', c.name],
                ['Phone', c.phoneNumber],
                ['SOS contact', c.sosContact],
                ['Joined', fmtDateTime(c.createdAt)],
                ['Last updated', fmtDateTime(c.updatedAt)],
                ['Customer ID', <span className="font-mono text-xs">{c._id}</span>],
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHead eyebrow="Saved places" title="Quick destinations" action={destinations.length > 1 && <Select className="w-36" {...destSort} />} />
          <CardBody>
            {destinations.length ? (
              <ul className="divide-y divide-line">
                {destinations.map((d) => (
                  <li key={d._id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{d.tag}</p>
                      <p className="truncate text-xs text-ink/55" title={d.dropLocationName}>{d.dropLocationName}</p>
                    </div>
                    {d.latitude != null && (
                      <a href={osmLink(d.latitude, d.longitude)} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-brand hover:text-brand-deep num">
                        {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/45">No saved places.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHead eyebrow="History" title="Rides" />
        <RideHistory filterKey="customerId" id={c._id} showDriver />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead eyebrow="Feedback" title="Reviews they wrote" action={reviews.length > 1 && <Select className="w-36" {...reviewSort} />} />
          <CardBody>
            {reviews.length ? (
              <ul className="divide-y divide-line">
                {reviews.map((r) => (
                  <li key={r._id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      {r.driverId ? (
                        <Link to={`/drivers/${r.driverId._id}`} className="text-sm font-medium hover:text-brand">{r.driverId.name || 'Driver'}</Link>
                      ) : (
                        <span className="text-sm text-ink/45">Driver removed</span>
                      )}
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-ink/70">{r.comment}</p>}
                    <p className="mt-1 text-[11px] text-ink/40">{fmtDate(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/45">No reviews written.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHead eyebrow="Internal" title="Notes" />
          <CardBody>
            <NotesPanel entity="user" entityId={c._id} />
          </CardBody>
        </Card>
      </div>

      <EditProfile open={editing} onClose={() => setEditing(false)} customer={c} onSaved={reload} />
    </>
  );
}
