import { useState } from 'react';
import { api, fieldMap } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, Card, CardBody, CardHead, ErrorNote, Field, Input, PageHead, useToast } from '../components/ui/index.js';

export default function ChangePassword() {
  const { refreshToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError({ message: 'Please fix the highlighted fields', fieldErrors: [{ field: 'confirm', message: 'Passwords do not match' }] });
      return;
    }
    setBusy(true);
    try {
      const d = await api.patch('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      refreshToken(d.token);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed. Other sessions have been signed out.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fe = fieldMap(error);
  return (
    <>
      <PageHead eyebrow="Account" title="Change password" description="At least 10 characters, with letters and numbers. Changing it signs you out on every other device." />
      <Card className="max-w-lg">
        <CardHead eyebrow="Security" title="Your password" />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Current password" error={fe.currentPassword}>
              <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={fe.currentPassword} />
            </Field>
            <Field label="New password" error={fe.newPassword}>
              <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={fe.newPassword} />
            </Field>
            <Field label="Repeat new password" error={fe.confirm}>
              <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={fe.confirm} />
            </Field>
            {error && !error.fieldErrors?.length && <ErrorNote error={error} />}
            <Button type="submit" loading={busy}>
              Change password
            </Button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
