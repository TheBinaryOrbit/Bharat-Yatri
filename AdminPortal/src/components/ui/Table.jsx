import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2 } from 'lucide-react';
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

// Nulls last, numbers and dates by value, text case-insensitively with numeric awareness.
const isEmpty = (v) => v === null || v === undefined || v === '';
const compare = (a, b) => {
  if (a instanceof Date || b instanceof Date) return new Date(a) - new Date(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
};

// Stable sort by `value(row)`; blanks stay at the bottom in both directions.
export function sortRows(rows, value, order = 'asc') {
  if (!rows?.length) return rows;
  const dir = order === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => [r, value(r), i])
    .sort(([, x, i], [, y, j]) => {
      if (isEmpty(x) || isEmpty(y)) return (isEmpty(x) === isEmpty(y) ? 0 : isEmpty(x) ? 1 : -1) || i - j;
      return dir * compare(x, y) || i - j;
    })
    .map(([r]) => r);
}

// Sort dropdown for lists that are not tables (cards, review lists).
// options: [{ value, label, by: (row) => any, order: 'asc' | 'desc' }] — the first is the default.
// Returns [sortedRows, props for <Select />].
export function useListSort(rows, options) {
  const [value, setValue] = useState(options[0].value);
  const opt = options.find((o) => o.value === value) || options[0];
  // Options are usually written inline, so key the memo on the chosen value, not the object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => sortRows(rows, opt.by, opt.order), [rows, value]);
  return [sorted, { value, onChange: (e) => setValue(e.target.value), options: options.map(({ value: v, label }) => ({ value: v, label })), 'aria-label': 'Sort' }];
}

// Header click cycles: ascending → descending → back to the list's default order.
const nextSort = (current, key) => {
  if (current?.by !== key) return { by: key, order: 'asc' };
  if (current.order === 'asc') return { by: key, order: 'desc' };
  return null;
};

// columns: [{ key, header, render?, align?, className?, tdClassName?, sortable?, sortKey?, sortValue? }]
// Sorting: a column is sortable when it sets `sortable` or `sortValue`. Pass `sort` + `onSort` to
// sort on the server (paginated lists); without `onSort` the rows are sorted here, using
// `sortValue(row)` or `row[key]`.
export function Table({ columns, rows, loading, onRowClick, empty, minWidth = 'min-w-[720px]', rowKey = (r) => r._id, sort, onSort }) {
  const [localSort, setLocalSort] = useState(null);
  const serverSide = typeof onSort === 'function';
  const active = serverSide ? (sort?.by ? sort : null) : localSort;
  const isSortable = (c) => Boolean(c.sortable || c.sortValue);
  const keyOf = (c) => c.sortKey || c.key;

  const shown = useMemo(() => {
    if (serverSide || !active || !rows?.length) return rows;
    const col = columns.find((c) => isSortable(c) && keyOf(c) === active.by);
    if (!col) return rows;
    return sortRows(rows, col.sortValue || ((r) => r[col.key]), active.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active, serverSide, columns]);

  const toggle = (c) => {
    const next = nextSort(active, keyOf(c));
    if (serverSide) onSort(next);
    else setLocalSort(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} border-collapse text-sm`}>
        <thead>
          <tr className="border-b border-line bg-mist/70">
            {columns.map((c) => {
              const right = c.align === 'right';
              const on = isSortable(c) && active?.by === keyOf(c);
              const Icon = !on ? ChevronsUpDown : active.order === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.key}
                  aria-sort={on ? (active.order === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`whitespace-nowrap px-4 py-2.5 text-eyebrow font-medium uppercase ${on ? 'text-ink/80' : 'text-ink/50'} ${right ? 'text-right' : 'text-left'} ${c.className || ''}`}
                >
                  {isSortable(c) ? (
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={`group inline-flex items-center gap-1 uppercase hover:text-ink ${right ? 'flex-row-reverse' : ''}`}
                      title="Sort by this column"
                    >
                      {c.header}
                      <Icon size={12} className={on ? 'text-brand' : 'text-ink/30 group-hover:text-ink/55'} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center text-ink/50">
                <Loader2 size={18} className="mx-auto animate-spin" />
              </td>
            </tr>
          ) : !shown?.length ? (
            <tr>
              <td colSpan={columns.length} className="py-14">
                {empty || <EmptyState title="Nothing matches" hint="Try clearing some filters." />}
              </td>
            </tr>
          ) : (
            shown.map((r, i) => (
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
