import { useMemo, useState } from 'react';
import { Pencil, Plus, Upload, ImageOff } from 'lucide-react';
import { api, fieldMap } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { fmtMoney, fmtNumber } from '../lib/format.js';
import {
  Badge, Button, Card, ChangeSummary, Confirm, EmptyState, ErrorNote, Field, InfoNote, Input, Modal, PageHead, Spinner,
  Textarea, Toggle, useToast,
} from '../components/ui/index.js';

const SAMPLE_TRIPS = [
  { label: 'Short city hop', km: 5, min: 15 },
  { label: 'Across town', km: 20, min: 40 },
  { label: 'Outstation', km: 150, min: 180 },
];

const fare = (t, km, min) => Math.round(Number(t.baseFare || 0) + Number(t.ratePerKm || 0) * km + Number(t.ratePerMinute || 0) * min);

const EMPTY = { slug: '', name: '', description: '', capacity: '4', baseFare: '', ratePerKm: '', ratePerMinute: '', features: '' };

const toForm = (t) => ({
  slug: t.slug,
  name: t.name || '',
  description: t.description || '',
  capacity: String(t.capacity ?? ''),
  baseFare: String(t.baseFare ?? ''),
  ratePerKm: String(t.ratePerKm ?? ''),
  ratePerMinute: String(t.ratePerMinute ?? ''),
  features: (t.features || []).join(', '),
});

const LABELS = {
  name: 'Name', description: 'Description', capacity: 'Seats', baseFare: 'Base fare (₹)', ratePerKm: 'Per km (₹)',
  ratePerMinute: 'Per minute (₹)', features: 'Features', icon: 'Icon',
};

const featuresList = (s) => s.split(',').map((f) => f.trim()).filter(Boolean);

function TypeIcon({ src, name }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img src={src} alt={name} onError={() => setBroken(true)} className="h-12 w-12 rounded-md border border-line bg-mist object-contain p-1" />
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-md border border-line bg-mist text-ink/35">
      <ImageOff size={16} />
    </span>
  );
}

function FarePreview({ values }) {
  return (
    <div className="rounded-md border border-line bg-mist/60 px-3 py-2.5">
      <p className="eyebrow mb-2">Suggested fare preview</p>
      <table className="w-full text-sm">
        <tbody>
          {SAMPLE_TRIPS.map((t) => (
            <tr key={t.label} className="border-b border-line/60 last:border-0">
              <td className="py-1.5 text-ink/60">
                {t.label} <span className="text-ink/40">· {t.km} km, {t.min} min</span>
              </td>
              <td className="py-1.5 text-right font-medium num">{fmtMoney(fare(values, t.km, t.min))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-ink/45">Base + per-km × distance + per-minute × duration, rounded. Riders may offer 0.8×–1.5× of this.</p>
    </div>
  );
}

function TypeModal({ open, onClose, initial, onSaved }) {
  const toast = useToast();
  const editing = Boolean(initial?._id);
  const [form, setForm] = useState(EMPTY);
  const [icon, setIcon] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open && !lastOpen) {
    setLastOpen(true);
    setForm(initial ? toForm(initial) : EMPTY);
    setIcon(null);
    setError(null);
  }
  if (!open && lastOpen) setLastOpen(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fe = fieldMap(error);

  const changes = useMemo(() => {
    if (!editing) return [];
    const before = toForm(initial);
    const out = Object.keys(LABELS)
      .filter((k) => k !== 'icon' && String(before[k] ?? '') !== String(form[k] ?? ''))
      .map((k) => ({ label: LABELS[k], before: before[k] || '—', after: form[k] || '—' }));
    if (icon) out.push({ label: 'Icon', before: initial.icon ? 'current image' : 'none', after: icon.name });
    return out;
  }, [editing, initial, form, icon]);

  const send = async (reason = '') => {
    const fd = new FormData();
    const base = editing ? toForm(initial) : {};
    Object.keys(EMPTY).forEach((k) => {
      if (editing && k === 'slug') return;
      if (editing && String(base[k] ?? '') === String(form[k] ?? '')) return;
      if (k === 'features') fd.append('features', JSON.stringify(featuresList(form.features)));
      else fd.append(k, form[k]);
    });
    if (icon) fd.append('icon', icon);
    if (reason) fd.append('reason', reason);
    setBusy(true);
    setError(null);
    try {
      const saved = editing ? await api.upload(`/vehicle-types/${initial._id}`, fd, 'PATCH') : await api.upload('/vehicle-types', fd);
      toast(editing ? 'Vehicle type updated' : 'Vehicle type created');
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (editing) {
      if (!changes.length) {
        onClose();
        return;
      }
      setConfirm(true);
    } else send().catch(() => {});
  };

  return (
    <>
      <Modal
        open={open && !confirm}
        onClose={onClose}
        eyebrow={editing ? `Edit · ${initial?.slug}` : 'New vehicle type'}
        title={editing ? initial?.name : 'Add a vehicle type'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={busy}>{editing ? 'Review changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" hint={editing ? 'Fixed — apps refer to it' : 'e.g. bharat_mini'} error={fe.slug}>
              <Input value={form.slug} onChange={set('slug')} disabled={editing} error={fe.slug} />
            </Field>
            <Field label="Name" error={fe.name}>
              <Input value={form.name} onChange={set('name')} error={fe.name} />
            </Field>
            <Field label="Description" className="sm:col-span-2" error={fe.description}>
              <Textarea value={form.description} onChange={set('description')} rows={2} />
            </Field>
            <Field label="Seats" error={fe.capacity}>
              <Input type="number" min="1" value={form.capacity} onChange={set('capacity')} error={fe.capacity} />
            </Field>
            <Field label="Base fare (₹)" error={fe.baseFare}>
              <Input type="number" min="0" step="0.5" value={form.baseFare} onChange={set('baseFare')} error={fe.baseFare} />
            </Field>
            <Field label="Per km (₹)" error={fe.ratePerKm}>
              <Input type="number" min="0" step="0.5" value={form.ratePerKm} onChange={set('ratePerKm')} error={fe.ratePerKm} />
            </Field>
            <Field label="Per minute (₹)" error={fe.ratePerMinute}>
              <Input type="number" min="0" step="0.1" value={form.ratePerMinute} onChange={set('ratePerMinute')} error={fe.ratePerMinute} />
            </Field>
            <Field label="Features" hint="Comma separated" className="sm:col-span-2" error={fe.features}>
              <Input value={form.features} onChange={set('features')} placeholder="AC available, Luggage space" />
            </Field>
            <Field label="Icon" hint="PNG only, up to 5 MB" className="sm:col-span-2" error={fe.icon}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line px-3 py-2.5 text-sm text-ink/55 hover:border-brand hover:bg-mist hover:text-brand">
                <Upload size={15} />
                {icon ? icon.name : editing && initial?.icon ? 'Replace the current icon' : 'Choose a PNG'}
                <input type="file" accept="image/png" hidden onChange={(e) => setIcon(e.target.files?.[0] || null)} />
              </label>
            </Field>
          </div>
          <div className="space-y-3">
            <FarePreview values={form} />
            {editing && <InfoNote>Changes apply to new fare estimates and new rides only. Existing rides and bids keep their fare.</InfoNote>}
          </div>
        </div>
        {error && <ErrorNote error={error} className="mt-4" />}
      </Modal>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={(reason) => send(reason)}
        eyebrow="Pricing change"
        title={`Save changes to ${initial?.name || ''}?`}
        confirmLabel="Save changes"
        tone="primary"
        reason
        reasonRequired={false}
        reasonLabel="Why (optional)"
      >
        <ChangeSummary changes={changes} />
        <p>Applies to new fare estimates and new rides only; existing rides keep their fare. This is recorded in the audit log.</p>
      </Confirm>
    </>
  );
}

export default function VehicleTypes() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/vehicle-types');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(null);

  const types = data?.data || [];
  const replace = (saved) =>
    setData((d) => {
      const list = d?.data || [];
      const exists = list.some((t) => t._id === saved._id);
      return { data: exists ? list.map((t) => (t._id === saved._id ? { ...t, ...saved } : t)) : [...list, { ...saved, vehicleCount: 0 }] };
    });

  const setActive = async (t, isActive) => {
    const fd = new FormData();
    fd.append('isActive', String(isActive));
    const saved = await api.upload(`/vehicle-types/${t._id}`, fd, 'PATCH');
    replace(saved);
    toast(isActive ? `${t.name} is live again` : `${t.name} deactivated`);
  };

  return (
    <>
      <PageHead
        eyebrow="Configuration"
        title="Vehicle types & fares"
        description="The categories riders choose from and the rates behind every suggested fare."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} /> New vehicle type
          </Button>
        }
      />
      <ErrorNote error={error} className="mb-4" />
      {loading ? (
        <Spinner />
      ) : !types.length ? (
        <Card className="py-14">
          <EmptyState title="No vehicle types yet" hint="Add the first category riders can book." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {types.map((t) => (
            <Card key={t._id} className={t.isActive ? '' : 'opacity-75'}>
              <div className="flex items-start gap-4 border-b border-line px-5 py-4">
                <TypeIcon src={t.icon} name={t.name} />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{t.slug}</p>
                  <h2 className="font-display text-xl leading-tight">{t.name}</h2>
                  {t.description && <p className="mt-1 text-sm text-ink/55">{t.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge value={t.isActive ? 'active' : 'inactive'} />
                  <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                    <Pencil size={13} /> Edit
                  </Button>
                </div>
              </div>
              <div className="px-5 py-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  {[
                    ['Base fare', fmtMoney(t.baseFare)],
                    ['Per km', `₹${t.ratePerKm}`],
                    ['Per minute', `₹${t.ratePerMinute}`],
                    ['Seats', t.capacity],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] uppercase tracking-wider text-ink/45">{k}</dt>
                      <dd className="mt-0.5 font-display text-2xl leading-none num">{v}</dd>
                    </div>
                  ))}
                </dl>
                {t.features?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {t.features.map((f) => (
                      <Badge key={f} tone="muted">{f}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink/55">
                    <span className="font-medium text-ink num">{fmtNumber(t.vehicleCount)}</span> vehicles registered · 20 km / 40 min ≈{' '}
                    <span className="font-medium text-ink num">{fmtMoney(fare(t, 20, 40))}</span>
                  </span>
                  <Toggle
                    checked={t.isActive}
                    label={t.isActive ? 'Bookable' : 'Hidden'}
                    onChange={(v) => (v ? setActive(t, true).catch(toast.error) : setToggling(t))}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <TypeModal open={creating || Boolean(editing)} initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={replace} />
      <Confirm
        open={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={() => setActive(toggling, false)}
        title={`Deactivate ${toggling?.name}?`}
        confirmLabel="Deactivate"
      >
        Riders will stop seeing {toggling?.name} in fare estimates. Rides already booked are not affected, and {fmtNumber(toggling?.vehicleCount)} registered vehicles keep their type.
      </Confirm>
    </>
  );
}
