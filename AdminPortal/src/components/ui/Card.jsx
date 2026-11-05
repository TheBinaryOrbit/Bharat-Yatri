import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export function Card({ className = '', children }) {
  return <section className={`rounded-lg border border-line bg-white shadow-card ${className}`}>{children}</section>;
}

export function CardHead({ eyebrow, title, action, className = '' }) {
  return (
    <header className={`flex items-start justify-between gap-4 border-b border-line px-5 py-3.5 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
        <h2 className="font-display text-lg leading-tight">{title}</h2>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-deep">
      {children}
      <ArrowUpRight size={13} />
    </Link>
  );
}

// Key/value block for detail pages (theme.md §14).
export function KeyValues({ items, cols = 2 }) {
  return (
    <dl className={`grid gap-x-8 gap-y-2.5 text-sm ${cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : ''}`}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2 last:border-0 sm:block sm:border-0 sm:pb-0">
          <dt className="text-ink/50">{k}</dt>
          <dd className="text-right font-medium sm:mt-0.5 sm:text-left">{v === '' || v == null ? <span className="text-ink/35">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
