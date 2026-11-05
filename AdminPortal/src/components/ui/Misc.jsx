import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Maximize2, RotateCw, ZoomIn, ZoomOut, ImageOff, MessageSquarePlus } from 'lucide-react';
import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';
import { ErrorNote, Input, Select, Textarea } from './Form.jsx';
import { api } from '../../lib/api.js';
import { daysAgo, fmtDateTime, initials, isoDay } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from './Toast.jsx';

export function PageHead({ eyebrow, title, description, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-3xl leading-none tracking-tight">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-ink/55">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Spinner({ className = '' }) {
  return (
    <div className={`flex justify-center py-16 text-ink/50 ${className}`}>
      <Loader2 size={18} className="animate-spin text-brand" />
    </div>
  );
}

export function Avatar({ name, src, size = 'h-9 w-9' }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-full border border-line object-cover`} />;
  }
  return (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft/30 text-[11px] font-semibold text-brand-deep`}>
      {initials(name)}
    </span>
  );
}

// Name over a muted second line, optionally linked.
export function Person({ name, sub, to, src, avatar = false }) {
  const body = (
    <span className="flex min-w-0 items-center gap-2.5">
      {avatar && <Avatar name={name} src={src} size="h-7 w-7" />}
      <span className="min-w-0">
        <span className={`block truncate font-medium ${to ? 'hover:text-brand' : ''}`}>{name || <span className="text-ink/35">Unnamed</span>}</span>
        {sub && <span className="block truncate text-xs text-ink/50">{sub}</span>}
      </span>
    </span>
  );
  return to ? (
    <Link to={to} onClick={(e) => e.stopPropagation()}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatCard({ eyebrow, value, caption, children, tone }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4 shadow-card">
      <p className="eyebrow">{eyebrow}</p>
      <p className={`mt-2 font-display text-3xl leading-none num ${tone === 'brand' ? 'text-brand-deep' : ''}`}>{value}</p>
      {caption && <p className="mt-1.5 text-[11px] uppercase tracking-wider text-ink/45">{caption}</p>}
      {children && <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">{children}</dl>}
    </div>
  );
}

export function StatRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-medium num">{value}</dd>
    </div>
  );
}

// Preset + custom date range. value = { from, to } as YYYY-MM-DD.
export const RANGE_PRESETS = [
  { key: 'today', label: 'Today', from: () => isoDay(), to: () => isoDay() },
  { key: 'yesterday', label: 'Yesterday', from: () => daysAgo(1), to: () => daysAgo(1) },
  { key: '7d', label: 'Last 7 days', from: () => daysAgo(6), to: () => isoDay() },
  { key: '30d', label: 'Last 30 days', from: () => daysAgo(29), to: () => isoDay() },
  { key: '90d', label: 'Last 90 days', from: () => daysAgo(89), to: () => isoDay() },
];

export function DateRange({ from, to, onChange, presets = true, className = '' }) {
  const active = RANGE_PRESETS.find((p) => p.from() === from && p.to() === to)?.key || (from || to ? 'custom' : '');
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {presets && (
        <Select
          className="w-36"
          value={active}
          onChange={(e) => {
            const p = RANGE_PRESETS.find((x) => x.key === e.target.value);
            if (p) onChange({ from: p.from(), to: p.to() });
            else if (e.target.value === '') onChange({ from: '', to: '' });
          }}
          placeholder="Any date"
          options={[...RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label })), ...(active === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])]}
        />
      )}
      <Input type="date" className="w-36" value={from || ''} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} aria-label="From" />
      <span className="text-xs text-ink/50">to</span>
      <Input type="date" className="w-36" value={to || ''} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} aria-label="To" />
    </div>
  );
}

// Before → after, shown before a pricing or settings save is confirmed.
export function ChangeSummary({ changes }) {
  if (!changes.length) return <p className="text-sm text-ink/55">Nothing has changed.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-eyebrow uppercase text-ink/50">
          <th className="py-1.5 pr-3 font-medium">Field</th>
          <th className="py-1.5 pr-3 font-medium">Now</th>
          <th className="py-1.5 font-medium">New</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => (
          <tr key={c.label} className="border-b border-line/60 last:border-0 align-top">
            <td className="py-2 pr-3 text-ink/60">{c.label}</td>
            <td className="py-2 pr-3 text-ink/55 line-through decoration-ink/25 num">{String(c.before ?? '—')}</td>
            <td className="py-2 font-medium text-ink num">
              <span className="inline-flex items-center gap-1.5">
                <ArrowRight size={12} className="text-brand" />
                {String(c.after ?? '—')}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A KYC / vehicle document thumbnail that opens a zoom + rotate viewer.
export function DocThumb({ label, src, className = '' }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [broken, setBroken] = useState(false);

  return (
    <figure className={className}>
      <button
        type="button"
        disabled={!src}
        onClick={() => {
          setZoom(1);
          setRot(0);
          setOpen(true);
        }}
        className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-line bg-mist disabled:cursor-default"
      >
        {src && !broken ? (
          <>
            <img src={src} alt={label} onError={() => setBroken(true)} className="h-full w-full object-cover" />
            <span className="absolute right-1.5 top-1.5 rounded bg-white/85 p-1 text-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 size={13} />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] text-ink/40">
            <ImageOff size={16} />
            {src ? 'Could not load' : 'Not uploaded'}
          </span>
        )}
      </button>
      <figcaption className="mt-1.5 text-[11px] uppercase tracking-wider text-ink/50">{label}</figcaption>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Document"
        title={label}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <ZoomOut size={14} /> Zoom out
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              <ZoomIn size={14} /> Zoom in
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRot((r) => (r + 90) % 360)}>
              <RotateCw size={14} /> Rotate
            </Button>
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md px-3 text-xs text-brand hover:bg-mist">
              Open original
            </a>
          </>
        }
      >
        <div className="flex h-[60vh] items-center justify-center overflow-auto rounded-md bg-mist">
          <img src={src} alt={label} style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }} className="max-h-full max-w-full transition-transform" />
        </div>
      </Modal>
    </figure>
  );
}

// Internal notes on a customer, driver, vehicle or ride.
export function NotesPanel({ entity, entityId }) {
  const { can } = useAuth();
  const toast = useToast();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    api
      .get('/notes', { entity, entityId })
      .then((d) => setNotes(d.data))
      .catch(setError);
  }, [entity, entityId]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const note = await api.post('/notes', { entity, entityId, body: text });
      setNotes((n) => [note, ...(n || [])]);
      setText('');
      toast('Note added');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {can('notes.write') && (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an internal note — only admins can see it" rows={2} maxLength={2000} />
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={add} loading={busy} disabled={!text.trim()}>
              <MessageSquarePlus size={14} /> Add note
            </Button>
          </div>
        </div>
      )}
      <ErrorNote error={error} />
      {notes === null && !error ? (
        <Spinner className="py-6" />
      ) : notes?.length ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n._id} className="rounded-md border border-line bg-mist/50 px-3 py-2.5">
              <p className="whitespace-pre-wrap text-sm text-ink/85">{n.body}</p>
              <p className="mt-1.5 text-[11px] text-ink/45">
                {n.adminId?.name || 'Admin'} · {fmtDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/45">No notes yet.</p>
      )}
    </div>
  );
}

// Segmented control used for tabs (Android / iOS, Quick / Outstation).
export function Tabs({ value, onChange, options, className = '' }) {
  return (
    <div className={`inline-flex rounded-md border border-line bg-mist p-0.5 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink'}`}
        >
          {o.label}
          {o.count != null && <span className="ml-1.5 text-ink/40 num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stars({ value, size = 'text-sm' }) {
  if (value == null) return <span className="text-ink/35">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${size}`}>
      <span className="text-brand">★</span>
      <span className="font-medium num">{Number(value).toFixed(1)}</span>
    </span>
  );
}
