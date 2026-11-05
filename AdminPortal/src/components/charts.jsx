// Shared chart pieces (recharts). Validated with the dataviz validator in light mode:
// lightness band, chroma floor, CVD ΔE ≥ 10 adjacent, contrast ≥ 3:1 — all PASS.
//
// Assign in this fixed order and keep each entity on its colour:
//   0 Quick ride  #2B6CB0 (navy-blue)   1 Outstation  #E8601A (brand orange)
//   2 #2A9D8F (teal)                     3 #8E6CC2 (violet)
export const SERIES = ['#2B6CB0', '#E8601A', '#2A9D8F', '#8E6CC2'];
export const RIDE_COLORS = { quickride: SERIES[0], outstation: SERIES[1] };

// Sequential (magnitude) — one hue, light → dark, orange.
export const SEQ = ['#FDE7D8', '#F9C29E', '#F4975F', '#E8601A', '#B8470F', '#7A2E08'];
export const seqColor = (t) => SEQ[Math.min(SEQ.length - 1, Math.max(0, Math.floor(t * SEQ.length)))];

export const AXIS = {
  tick: { fill: 'rgba(14,42,71,0.5)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
};
export const GRID = { stroke: '#D3DAE3', strokeDasharray: '0', vertical: false };

export const shortDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Tooltip body: values in ink, colour only on the swatch.
export function ChartTooltip({ active, payload, label, labelFormat = shortDay, valueFormat = (v) => Number(v).toLocaleString('en-IN') }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-ink">{labelFormat ? labelFormat(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-ink/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-ink num">{valueFormat(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/60">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// Horizontal bar list (top areas, vehicle types) — thin track, brand-soft fill.
export function BarList({ rows, valueFormat = (v) => v.toLocaleString('en-IN'), color = '#F4975F' }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${valueFormat(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-ink/50 num">{valueFormat(r.value)}</span>
          </div>
          <div className="h-1 rounded-full bg-mist">
            <div className="h-1 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
