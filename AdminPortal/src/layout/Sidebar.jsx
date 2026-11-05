import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { NAV } from './nav.js';
import { useAuth } from '../lib/auth.jsx';

export function Wordmark({ size = 'text-xl', tracking = 'tracking-[0.14em]', light = true }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" className="h-9 w-9 rounded-md" />
      <span className={`font-display ${size} leading-none ${tracking} ${light ? 'text-white' : 'text-ink'}`}>BHARAT YAATRI</span>
    </span>
  );
}

// Navy sidebar (the logo's ground colour). Active cue is a 1px orange hairline, not a pill.
export function Sidebar({ open, onClose, badges }) {
  const { can } = useAuth();
  const activeRides = (badges?.activeQuickRides || 0) + (badges?.activeOutstationRides || 0);
  const counts = { ...badges, activeRides };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-navy-dark bg-navy transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <Wordmark />
          <p className="mt-2 pl-[2.9rem] text-eyebrow font-medium uppercase text-brand">Admin</p>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-5">
              <p className="px-2 pb-2 text-eyebrow font-medium uppercase text-white/40">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const count = item.badge ? counts?.[item.badge] : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                            isActive ? 'bg-white/[0.08] font-medium text-white' : 'text-white/65 hover:bg-white/[0.05] hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className={`absolute left-0 h-4 w-px ${isActive ? 'bg-brand' : 'bg-transparent'}`} />
                            <Icon size={16} className={`shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-white/45 group-hover:text-brand'}`} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {count > 0 && (
                              <span className="rounded-full bg-brand/90 px-1.5 py-0.5 text-[10px] font-semibold text-white num">{count}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <p className="border-t border-white/10 px-5 py-3 text-[11px] text-white/35">Bharat Yaatri · Partner operations</p>
    </aside>
  );
}
