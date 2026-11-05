import { Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui/index.js';

export function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Loader2 size={20} className="animate-spin text-brand" />
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow">403</p>
      <h1 className="mt-2 font-display text-3xl">This page isn’t part of your role</h1>
      <p className="mt-2 text-sm text-ink/55">Ask a super admin if you need access to it.</p>
    </div>
  );
}

// Route guard by permission.
export function RequirePerm({ perm, children }) {
  const { can } = useAuth();
  return can(...[].concat(perm)) ? children : <Forbidden />;
}

export function AdminLayout() {
  const { admin, booting } = useAuth();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (!admin) return undefined;
    const load = () => api.get('/badges').then(setBadges).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [admin, location.pathname]);

  if (booting) return <BootScreen />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <div className="min-h-screen bg-white">
      <Sidebar open={open} onClose={() => setOpen(false)} badges={badges} />
      {open && <div className="fixed inset-0 z-30 bg-ink/25 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
