import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { initials } from '../lib/format.js';
import { Badge } from '../components/ui/index.js';

export function Topbar({ onMenu }) {
  const { admin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} className="text-ink/60 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <p className="eyebrow hidden lg:block">{today}</p>
      <div className="relative ml-auto">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-md border border-line px-2 py-1.5 hover:bg-mist">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft/30 text-[11px] font-semibold text-brand-deep">
            {initials(admin?.name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-medium leading-tight">{admin?.name}</span>
            <span className="block text-[10px] uppercase tracking-wider text-ink/45">{admin?.roleLabel}</span>
          </span>
          <ChevronDown size={14} className="text-ink/45" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-60 animate-fade-up rounded-lg border border-line bg-white p-1.5 shadow-card">
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium">{admin?.name}</p>
                <p className="truncate text-xs text-ink/50">{admin?.email}</p>
                <Badge value={admin?.role} className="mt-2">
                  {admin?.roleLabel}
                </Badge>
              </div>
              <hr className="my-1 border-line" />
              <Link
                to="/account/password"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink/75 hover:bg-mist hover:text-ink"
              >
                <KeyRound size={15} className="text-ink/45" /> Change password
              </Link>
              <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink/75 hover:bg-mist hover:text-ink">
                <LogOut size={15} className="text-ink/45" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
