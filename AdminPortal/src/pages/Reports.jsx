import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { daysAgo, fmtDate, fmtMinutes, fmtMoney, fmtNumber, fmtPercent, isoDay } from '../lib/format.js';
import {
  Button, Card, CardBody, CardHead, DateRange, ErrorNote, InfoNote, PageHead, Select, Spinner, StatCard, StatRow, Table, Tabs, useToast,
} from '../components/ui/index.js';
import { AXIS, BarList, ChartTooltip, GRID, Legend, RIDE_COLORS, SERIES, shortDay } from '../components/charts.jsx';

const TYPE_LABEL = { quickride: 'Quick rides', outstation: 'Outstation rides' };

function RangeNote({ range }) {
  if (!range) return null;
  return (
    <p className="text-xs text-ink/45">
      {fmtDate(range.from)} – {fmtDate(range.to)} · IST
    </p>
  );
}

function RidesReport({ data }) {
  const types = data.types || [];
  return (
    <div className="space-y-5">
      <div className={`grid gap-5 ${types.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {types.map((t) => {
          const s = t.summary;
          return (
            <StatCard key={t.rideType} eyebrow={TYPE_LABEL[t.rideType]} value={fmtNumber(s.created)} caption="Rides booked">
              <StatRow label="Completed" value={`${fmtNumber(s.completed)} · ${fmtPercent(s.completionRate)}`} />
              <StatRow label="Cancelled" value={`${fmtNumber(s.cancelled)} · ${fmtPercent(s.cancellationRate)}`} />
              <StatRow label="No driver (expired)" value={`${fmtNumber(s.expired)} · ${fmtPercent(s.noDriverRate)}`} />
              <StatRow label="Ride value (fares agreed, not platform revenue)" value={fmtMoney(s.completedValue)} />
              <StatRow label="Avg time to accept a bid" value={fmtMinutes(s.avgMinutesToAccept)} />
              <StatRow
                label="Accepted fare vs rider offer"
                value={s.avgAcceptedFareVsOffer == null ? '—' : `${s.avgAcceptedFareVsOffer >= 0 ? '+' : '−'}${fmtMoney(Math.abs(s.avgAcceptedFareVsOffer))}`}
              />
              <StatRow label="Avg distance" value={s.avgDistanceKm == null ? '—' : `${s.avgDistanceKm.toFixed(1)} km`} />
            </StatCard>
          );
        })}
      </div>

      <Card>
        <CardHead
          eyebrow="Per day"
          title="Rides booked"
          action={<Legend items={types.map((t) => ({ label: TYPE_LABEL[t.rideType], color: RIDE_COLORS[t.rideType] }))} />}
        />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
                <YAxis allowDecimals={false} {...AXIS} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C5CED9' }} />
                {types.map((t) => (
                  <Line key={t.rideType} dataKey={`${t.rideType}Created`} name={TYPE_LABEL[t.rideType]} stroke={RIDE_COLORS[t.rideType]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {types.map((t) => (
        <Card key={`${t.rideType}-out`}>
          <CardHead
            eyebrow={TYPE_LABEL[t.rideType]}
            title="Outcomes per day"
            action={<Legend items={[{ label: 'Completed', color: SERIES[2] }, { label: 'Cancelled', color: SERIES[3] }, { label: 'Expired', color: '#9AA8B8' }]} />}
          />
          <CardBody>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="25%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="day" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(14,42,71,0.04)' }} />
                  <Bar dataKey={`${t.rideType}Completed`} name="Completed" stackId="o" fill={SERIES[2]} stroke="#fff" strokeWidth={1} />
                  <Bar dataKey={`${t.rideType}Cancelled`} name="Cancelled" stackId="o" fill={SERIES[3]} stroke="#fff" strokeWidth={1} />
                  <Bar dataKey={`${t.rideType}Expired`} name="Expired" stackId="o" fill="#9AA8B8" stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
          <div className="border-t border-line">
            <Table
              minWidth="min-w-[560px]"
              rowKey={(r) => r.name}
              columns={[
                { key: 'name', header: 'Vehicle type', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
                { key: 'rides', header: 'Booked', align: 'right', sortable: true, render: (r) => fmtNumber(r.rides) },
                { key: 'completed', header: 'Completed', align: 'right', sortable: true, render: (r) => fmtNumber(r.completed) },
                { key: 'rate', header: 'Completion', align: 'right', sortValue: (r) => (r.rides ? r.completed / r.rides : null), render: (r) => fmtPercent(r.rides ? r.completed / r.rides : null) },
                { key: 'value', header: 'Ride value', align: 'right', sortable: true, render: (r) => fmtMoney(r.value) },
              ]}
              rows={t.byVehicleType}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PeopleTable({ kind, rows }) {
  const driver = kind === 'drivers';
  const columns = driver
    ? [
        { key: 'name', header: 'Driver', sortable: true, render: (r) => <Link to={`/drivers/${r.driverId}`} className="font-medium hover:text-brand">{r.name}<span className="block text-xs font-normal text-ink/50">{r.phoneNumber}</span></Link> },
        { key: 'assigned', header: 'Assigned', align: 'right', sortable: true, render: (r) => fmtNumber(r.assigned) },
        { key: 'completed', header: 'Completed', align: 'right', sortable: true, render: (r) => fmtNumber(r.completed) },
        { key: 'cancelledByDriver', header: 'Driver cancels', align: 'right', sortable: true, render: (r) => fmtNumber(r.cancelledByDriver) },
        { key: 'completedValue', header: 'Ride value', align: 'right', sortable: true, render: (r) => fmtMoney(r.completedValue) },
        { key: 'rating', header: 'Rating', align: 'right', sortable: true, render: (r) => (r.rating == null ? '—' : `★ ${r.rating.toFixed(1)} (${r.reviews})`) },
      ]
    : [
        { key: 'name', header: 'Customer', sortable: true, render: (r) => <Link to={`/customers/${r.customerId}`} className="font-medium hover:text-brand">{r.name}<span className="block text-xs font-normal text-ink/50">{r.phoneNumber}</span></Link> },
        { key: 'joinedAt', header: 'Joined', sortable: true, render: (r) => fmtDate(r.joinedAt) },
        { key: 'booked', header: 'Booked', align: 'right', sortable: true, render: (r) => fmtNumber(r.booked) },
        { key: 'completed', header: 'Completed', align: 'right', sortable: true, render: (r) => fmtNumber(r.completed) },
        { key: 'cancelledByUser', header: 'Customer cancels', align: 'right', sortable: true, render: (r) => fmtNumber(r.cancelledByUser) },
        { key: 'completedValue', header: 'Ride value', align: 'right', sortable: true, render: (r) => fmtMoney(r.completedValue) },
      ];
  return (
    <Card>
      <CardHead eyebrow="Top 100 in the window" title={driver ? 'Drivers by completed rides' : 'Customers by rides booked'} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.driverId || r.customerId} />
    </Card>
  );
}

function AreasReport({ data }) {
  const toRows = (list) => list.slice(0, 15).map((a) => ({ label: a.area, value: a.rides }));
  return (
    <div className="space-y-5">
      <InfoNote>{data.note}</InfoNote>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead eyebrow="Where rides start" title="Top pickup areas" />
          <CardBody>{data.pickups.length ? <BarList rows={toRows(data.pickups)} /> : <p className="text-sm text-ink/45">No rides in this window.</p>}</CardBody>
        </Card>
        <Card>
          <CardHead eyebrow="Where rides end" title="Top drop areas" />
          <CardBody>{data.drops.length ? <BarList rows={toRows(data.drops)} color="#7FA6D6" /> : <p className="text-sm text-ink/45">No rides in this window.</p>}</CardBody>
        </Card>
      </div>
      <Card>
        <CardHead eyebrow="Pickup areas" title="Supply gaps" />
        <Table
          minWidth="min-w-[520px]"
          rowKey={(r) => r.area}
          columns={[
            { key: 'area', header: 'Area', sortable: true, render: (r) => <span className="font-medium">{r.area}</span> },
            { key: 'rides', header: 'Rides', align: 'right', sortable: true, render: (r) => fmtNumber(r.rides) },
            { key: 'completed', header: 'Completed', align: 'right', sortable: true, render: (r) => fmtNumber(r.completed) },
            { key: 'expired', header: 'No driver', align: 'right', sortable: true, render: (r) => fmtNumber(r.expired) },
            { key: 'rate', header: 'No-driver rate', align: 'right', sortValue: (r) => (r.rides ? r.expired / r.rides : null), render: (r) => fmtPercent(r.rides ? r.expired / r.rides : null) },
          ]}
          rows={data.pickups}
        />
      </Card>
    </div>
  );
}

export default function Reports() {
  const { can } = useAuth();
  const toast = useToast();
  const [f, setF] = useUrlFilters({ tab: 'rides', from: daysAgo(29), to: isoDay(), rideType: '' });
  const params = { from: f.from, to: f.to, rideType: f.rideType };
  const { data, error, loading } = useApi(`/reports/${f.tab}`, params);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download(`/reports/${f.tab}`, params, `${f.tab}-report.csv`);
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Insights"
        title="Reports"
        description="Ride, driver, customer and area numbers for any window. Ride value is the total of fares agreed on completed rides — not what the platform earns."
        action={
          can('reports.export') && (
            <Button variant="secondary" onClick={exportCsv} loading={exporting}>
              <Download size={14} /> Export CSV
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={f.tab}
          onChange={(tab) => setF({ tab })}
          options={[
            { value: 'rides', label: 'Rides' },
            { value: 'drivers', label: 'Drivers' },
            { value: 'customers', label: 'Customers' },
            { value: 'areas', label: 'Areas' },
          ]}
        />
        <Select
          className="w-44"
          value={f.rideType}
          onChange={(e) => setF({ rideType: e.target.value })}
          placeholder="Both ride types"
          options={[{ value: 'quickride', label: 'Quick rides' }, { value: 'outstation', label: 'Outstation rides' }]}
        />
        <DateRange from={f.from} to={f.to} onChange={({ from, to }) => setF({ from, to })} className="ml-auto" />
      </div>
      <div className="mb-3">
        <RangeNote range={data?.range} />
      </div>
      <ErrorNote error={error} className="mb-4" />
      {(() => {
        // The previous tab's data can still be in hand for one render after switching, so each
        // view checks it has the shape it needs before drawing.
        const ready =
          !loading &&
          data &&
          (f.tab === 'rides' ? Array.isArray(data.types) : f.tab === 'areas' ? Array.isArray(data.pickups) : Array.isArray(data.data));
        if (!ready) return error ? null : <Spinner />;
        if (f.tab === 'rides') return <RidesReport data={data} />;
        if (f.tab === 'areas') return <AreasReport data={data} />;
        return <PeopleTable kind={f.tab} rows={data.data} />;
      })()}
    </>
  );
}
