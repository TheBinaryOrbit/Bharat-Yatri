import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../layout/AuthShell.jsx';
import { BootScreen } from '../layout/AdminLayout.jsx';
import { useAuth } from '../lib/auth.jsx';
import { fieldMap } from '../lib/api.js';
import { Button, ErrorNote, Field, Input } from '../components/ui/index.js';

export default function Login() {
  const { admin, booting, signIn, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (booting) return <BootScreen />;
  if (admin) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fe = fieldMap(error);
  return (
    <AuthShell title="Sign in" description="Use the admin account your super admin created for you.">
      {sessionExpired && (
        <div className="mb-4 rounded-md border border-line bg-mist px-3 py-2.5 text-sm text-ink/70">Your session ended. Please sign in again.</div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fe.email} autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password}>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe.password} />
        </Field>
        {error && !error.fieldErrors?.length && <ErrorNote error={error} />}
        <Button type="submit" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
