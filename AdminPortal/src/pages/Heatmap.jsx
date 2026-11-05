import { useMemo, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { daysAgo, fmtAgo, fmtDate, fmtNumber, isoDay } from '../lib/format.js';
import { BaseMap, FitBounds } from '../components/map/BaseMap.jsx';
import { HeatLayer } from '../components/map/HeatLayer.jsx';
import { SEQ } from '../components/charts.jsx';
import { Button, Card, DateRange, ErrorNote, InfoNote, PageHead, Select, Tabs, Toolbar } from '../components/ui/index.js';

const CELLS = [
  { value: '0.005', label: '≈ 0.5 km cells' },
  { value: '0.01', label: '≈ 1 km cells' },
  { value: '0.02', label: '≈ 2 km cells' },
  { value: '0.05', label: '≈ 5 km cells' },
];

const cellLabel = (deg) => CELLS.find((c) => Number(c.value) === Number(deg))?.label.replace(' cells', '') || `${deg}°`;

// Radius in screen pixels that roughly matches the grid cell at street zooms.
const radiusFor = (deg) => ({ 0.005: 18, 0.01: 24, 0.02: 30, 0.05: 40 }[deg] || 24);

function HeatLegend({ max, unit, cellDeg, window: win }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line px-5 py-3 text-xs text-ink/60">
      <div>
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-ink/45">{unit} per cell</p>
        <div className="flex items-center gap-2">
          <span>Low</span>
          <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${SEQ.join(', ')})` }} />
          <span>High{max ? ` (${fmtNumber(max)})` : ''}</span>
        </div>
      </div>
      <p>
        Cell size {cellLabel(cellDeg)} · {win}
      </p>
    </div>
  );
}

export default function Heatmap() {
  const [f, setF] = useUrlFilters({ mode: 'supply', cell: '0.01' });
  const [range, setRange] = useState({ from: f.from || daysAgo(29), to: f.to || isoDay() });
  const supply = f.mode === 'supply';

  const { data: types } = useApi('/vehicle-types');
  const { data, error, loading, reload } = useApi(
    supply ? '/heatmap/supply' : '/heatmap/demand',
    supply
      ? { vehicleTypeId: f.vehicleTypeId, state: f.state, cell: f.cell }
      : { vehicleTypeId: f.vehicleTypeId, rideType: f.rideType, cell: f.cell, from: range.from, to: range.to },
    { interval: supply ? 30000 : 0 }
  );

  const cells = data?.data || [];
  const points = useMemo(() => cells.map((c) => [c.latitude, c.longitude]), [cells]);
  const windowText = supply
    ? `live positions, updated ${fmtAgo(data?.generatedAt)}`
    : data?.range
    ? `rides booked ${fmtDate(data.range.from)} – ${fmtDate(data.range.to)} (IST)`
    : '';

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Heatmap"
        description="Where drivers are, and where riders ask for them. Areas are aggregated into grid cells — no individual driver or rider is shown."
        action={
          <Button variant="secondary" size="sm" onClick={() => reload()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar>
          <Tabs
            value={f.mode}
            onChange={(mode) => setF({ mode })}
            options={[
              { value: 'supply', label: 'Driver supply' },
              { value: 'demand', label: 'Ride demand' },
            ]}
          />
          <Select
            className="w-40"
            placeholder="Any vehicle"
            value={f.vehicleTypeId || ''}
            onChange={(e) => setF({ vehicleTypeId: e.target.value })}
            options={(types?.data || []).map((t) => ({ value: t._id, label: t.name }))}
          />
          {supply ? (
            <Select
              className="w-40"
              placeholder="Every driver state"
              value={f.state || ''}
              onChange={(e) => setF({ state: e.target.value })}
              options={[
                { value: 'available', label: 'Available' },
                { value: 'on_trip', label: 'On a trip' },
                { value: 'disconnected', label: 'Disconnected' },
              ]}
            />
          ) : (
            <Select
              className="w-40"
              placeholder="Both ride types"
              value={f.rideType || ''}
              onChange={(e) => setF({ rideType: e.target.value })}
              options={[
                { value: 'quickride', label: 'Quick rides' },
                { value: 'outstation', label: 'Outstation' },
              ]}
            />
          )}
          <Select className="w-40" value={f.cell} onChange={(e) => setF({ cell: e.target.value })} options={CELLS} />
          {!supply && (
            <div className="ml-auto">
              <DateRange
                from={range.from}
                to={range.to}
                onChange={(r) => {
                  setRange(r);
                  setF({ from: r.from, to: r.to });
                }}
              />
            </div>
          )}
        </Toolbar>

        <div className="space-y-3 px-5 pt-4">
          <ErrorNote error={error} />
          {supply ? (
            <InfoNote icon={Info}>
              {data?.note || 'Current positions only — driver location history is not stored.'}{' '}
              {data && (
                <>
                  <strong className="num">{fmtNumber(data.totalDrivers)}</strong> driver{data.totalDrivers === 1 ? '' : 's'} counted.
                </>
              )}
            </InfoNote>
          ) : (
            <InfoNote icon={Info}>
              Pickup points of every ride booked in the window, whatever happened to it afterwards.{' '}
              {data && (
                <>
                  <strong className="num">{fmtNumber(data.totalRides)}</strong> ride{data.totalRides === 1 ? '' : 's'} counted.
                </>
              )}
            </InfoNote>
          )}
        </div>

        <div className="relative mt-4">
          <BaseMap className="h-[calc(100vh-24rem)] min-h-[26rem]">
            <FitBounds points={points} trigger={`${f.mode}-${points.length > 0}`} />
            <HeatLayer points={cells} maxCount={data?.maxCount} radius={radiusFor(Number(data?.cellDeg ?? f.cell))} />
          </BaseMap>
          {!loading && data && !cells.length && (
            <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
              <div className="rounded-lg border border-line bg-white/95 px-6 py-5 text-center shadow-card">
                <p className="font-display text-lg">{supply ? 'No drivers online right now' : 'No rides in this window'}</p>
                <p className="mt-1 text-sm text-ink/55">{supply ? 'Try again when drivers are active, or switch to ride demand.' : 'Pick a wider date range.'}</p>
              </div>
            </div>
          )}
        </div>
        <HeatLegend max={data?.maxCount} unit={supply ? 'Drivers' : 'Rides'} cellDeg={data?.cellDeg ?? f.cell} window={windowText} />
      </Card>
    </>
  );
}
