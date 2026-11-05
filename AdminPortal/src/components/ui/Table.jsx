import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './Button.jsx';

export function EmptyState({ title = 'Nothing here yet', hint, action }) {
  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/55">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// columns: [{ key, header, render?, align?, className?, tdClassName? }]
export function Table({ columns, rows, loading, onRowClick, empty, minWidth = 'min-w-[720px]', rowKey = (r) => r._id }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} border-collapse text-sm`}>
        <thead>
          <tr className="border-b border-line bg-mist/70">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-4 py-2.5 text-eyebrow font-medium uppercase text-ink/50 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.className || ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center text-ink/50">
                <Loader2 size={18} className="mx-auto animate-spin" />
              </td>
            </tr>
          ) : !rows?.length ? (
            <tr>
              <td colSpan={columns.length} className="py-14">
                {empty || <EmptyState title="Nothing matches" hint="Try clearing some filters." />}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={rowKey(r) ?? i}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-line/70 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-mist' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right' : ''} ${c.tdClassName || ''}`}>
                    {c.render ? c.render(r) : r[c.key] ?? <span className="text-ink/35">—</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total = 0, limit = 20, onPage, onLimit }) {
  const p = Number(page);
  const start = total ? (p - 1) * limit + 1 : 0;
  const end = Math.min(p * limit, total);
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink/60">
      <span className="num">{total ? `${start.toLocaleString('en-IN')}–${end.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : 'Nothing to show'}</span>
      <div className="flex items-center gap-2">
        {onLimit && (
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            className="h-8 rounded-md border border-line bg-white px-2 text-xs"
            aria-label="Rows per page"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
        <Button variant="secondary" size="icon" disabled={p <= 1} onClick={() => onPage(p - 1)} aria-label="Previous page">
          <ChevronLeft size={15} />
        </Button>
        <span className="num">
          {p} / {Math.max(pages, 1)}
        </span>
        <Button variant="secondary" size="icon" disabled={p >= pages} onClick={() => onPage(p + 1)} aria-label="Next page">
          <ChevronRight size={15} />
        </Button>
      </div>
    </footer>
  );
}

export function Toolbar({ children, className = '' }) {
  return <div className={`flex flex-wrap items-center gap-2 border-b border-line bg-mist/60 px-5 py-3 ${className}`}>{children}</div>;
}
