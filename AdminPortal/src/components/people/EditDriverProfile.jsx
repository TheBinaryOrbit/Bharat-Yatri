import { useEffect, useState } from 'react';
import { api, fieldMap } from '../../lib/api.js';
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea, useToast } from '../ui/index.js';

const toDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Edit the driver's personal details. Only changed fields are sent, so a masked value the admin
// never touched cannot be written back. Phone (the login) and KYC are not editable here.
export function EditDriverProfile({ open, onClose, driver, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [initial, setInitial] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = {
      name: driver.name || '',
      email: driver.email || '',
      dob: toDay(driver.dob),
      gender: driver.gender || '',
      address: driver.address || '',
      dlNumber: driver.dlDetails?.dlNumber || '',
    };
    setForm(start);
    setInitial(start);
    setError(null);
  }, [open, driver]);

  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== initial[k]));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/drivers/${driver._id}`, changed);
      toast('Driver profile updated');
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const fe = fieldMap(error);
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Driver"
      title="Edit profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!Object.keys(changed).length}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fe.name} className="sm:col-span-2">
          <Input value={form.name || ''} onChange={set('name')} error={fe.name} maxLength={80} />
        </Field>
        <Field label="Email" hint="Optional" error={fe.email}>
          <Input type="email" value={form.email || ''} onChange={set('email')} error={fe.email} />
        </Field>
        <Field label="Date of birth" error={fe.dob}>
          <Input type="date" value={form.dob || ''} onChange={set('dob')} error={fe.dob} />
        </Field>
        <Field label="Gender" error={fe.gender}>
          <Select
            value={form.gender || ''}
            onChange={set('gender')}
            error={fe.gender}
            placeholder="Not set"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </Field>
        <Field label="Driving licence number" error={fe.dlNumber}>
          <Input value={form.dlNumber || ''} onChange={(e) => setForm((f) => ({ ...f, dlNumber: e.target.value.toUpperCase() }))} error={fe.dlNumber} maxLength={20} />
        </Field>
        <Field label="Address" error={fe.address} className="sm:col-span-2">
          <Textarea value={form.address || ''} onChange={set('address')} error={fe.address} rows={2} maxLength={300} />
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-ink/45">
        The phone number is the login and can’t be changed here. KYC is handled from the Licence &amp; KYC tab. Changes are recorded in the audit log.
      </p>
      {error && !error.fieldErrors?.length && <ErrorNote error={error} className="mt-3" />}
    </Modal>
  );
}
