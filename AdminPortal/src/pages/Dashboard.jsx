import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { useApi, useUrlFilters } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { daysAgo, fmtMoney, fmtNumber, isoDay, RIDE_STATUS_LABEL, fmtDate } from '../lib/format.js';
import { AXIS, BarList, ChartTooltip, GRID, Legend, RIDE_COLORS, SERIES, shortDay } from '../components/charts.jsx';
import { Card, CardBody, CardHead, CardLink, DateRange, ErrorNote, PageHead, Spinner, StatCard, StatRow } from '../components/ui/index.js';

// One "work queue" cell: a count that asks for action, and where to go.
function QueueCell({ label, count, action, to }) {
  const hot = count > 0;
  return (
    <Link to={to} className={`group block px-5 py-5 transition-colors ${hot ? 'bg-white/70' : ''} hover:bg-white`}>
      <p className="text-[11px] uppercase tracking-wider text-ink/50">{label}</p>
      <p className={`mt-2 font-display text-4xl leading-none num ${hot ? 'text-brand-deep' : 'text-ink/25'}`}>{fmtNumber(count ?? 0)}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink/45 group-hover:text-brand">
        {hot ? action : 'All clear'}
        <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const [f, setF] = useUrlFilters({ from: daysAgo(29), to: isoDay() });
  const range = { from: f.from, to: f.to };
  const summary = useApi('/dashboard/summary', range, { interval: 60000 });
  const series = useApi('/dashboard/timeseries', range);
  const s = summary.data;
  const days = series.data?.days || [];

  const statusRows = s
    ? Object.keys(RIDE_STATUS_LABEL)
        .map((k) => ({ label: RIDE_STATUS_LABEL[k], value: (s.quickRides.inRangeByStatus[k] || 0) + (s.outstationRides.inRangeByStatus[k] || 0) }))
        .filter((r) => r.value > 0)
    : [];
  const rangeLabel = `${fmtDate(f.from)} – ${fmtDate(f.to)} · IST`;

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Dashboard"
        description="What needs attention now, and how the marketplace moved in the selected period."
        action={<DateRange from={f.from} to={f.to} onChange={(r) => setF(r)} />}
      />
      <ErrorNote error={summary.error} className="mb-5" />

      {!s ? (
        summary.loading ? <Spinner /> : null
      ) : (
        <>
          <div className="mb-7 overflow-hidden rounded-lg border border-line bg-mist">
            <div className="border-b border-line px-5 py-3">
              <p className="eyebrow">Needs attention</p>
            </div>
            <div className="grid divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
              <QueueCell label="KYC waiting for review" count={s.drivers.pendingManualKyc} action="Review documents" to={can('kyc.review') ? '/kyc' : '/drivers?kycStatus=pending'} />
              <QueueCell label="Quick rides on the road" count={s.quickRides.ongoing} action="Watch live" to="/quick-rides?status=assigned,in_progress" />
              <QueueCell label="Outstation trips active" count={s.outstationRides.ongoing} action="Open trips" to="/outstation-rides?status=assigned,arriving,in_progress" />
              <QueueCell label="Rides searching for a driver" count={(s.quickRides.byStatus.searching || 0) + (s.outstationRides.byStatus.searching || 0)} action="See open requests" to="/live" />
            </div>
          </div>

          <div className="mb-7 grid gap-5 lg:grid-cols-3">
            <StatCard eyebrow="Customers" value={fmtNumber(s.customers.total)} caption={`${fmtNumber(s.customers.newInRange)} joined in period`}>
              <StatRow label="Blocked" value={fmtNumber(s.customers.blocked)} />
            </StatCard>
            <StatCard eyebrow="Drivers" value={fmtNumber(s.drivers.total)} caption={`${fmtNumber(s.drivers.newInRange)} joined in period`}>
              <StatRow label="KYC verified" value={fmtNumber(s.drivers.kyc.verified)} />
              <StatRow label="KYC pending" value={fmtNumber(s.drivers.kyc.pending)} />
              <StatRow label="KYC rejected" value={fmtNumber(s.drivers.kyc.rejected)} />
              <StatRow label="Not started" value={fmtNumber(s.drivers.kyc.notStarted)} />
              <StatRow label="Onboarding finished" value={fmtNumber(s.drivers.onboardingComplete)} />
              <StatRow label="Blocked" value={fmtNumber(s.drivers.blocked)} />
            </StatCard>
            <StatCard eyebrow="Ride value in period" value={fmtMoney(s.rideValue.total)} caption="Fares agreed on completed rides — not platform revenue">
              <StatRow label="Quick rides" value={`${fmtMoney(s.rideValue.quick.value)} · ${fmtNumber(s.rideValue.quick.rides)}`} />
              <StatRow label="Outstation" value={`${fmtMoney(s.rideValue.outstation.value)} · ${fmtNumber(s.rideValue.outstation.rides)}`} />
            </StatCard>
          </div>

          <div className="mb-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard eyebrow="Drivers online now" value={s.drivers.live ? fmtNumber(s.drivers.live.online) : '—'} caption={s.drivers.live ? `${fmtNumber(s.drivers.live.onTrip)} on a trip · ${fmtNumber(s.drivers.live.disconnected)} reconnecting` : 'Live data unavailable'} />
            <StatCard eyebrow="Rides in period" value={fmtNumber(s.quickRides.inRange + s.outstationRides.inRange)} caption={`${fmtNumber(s.quickRides.inRange)} quick · ${fmtNumber(s.outstationRides.inRange)} outstation`} />
            <StatCard eyebrow="Completed in period" value={fmtNumber((s.quickRides.inRangeByStatus.completed || 0) + (s.outstationRides.inRangeByStatus.completed || 0))} caption={`${fmtNumber((s.quickRides.inRangeByStatus.cancelled || 0) + (s.outstationRides.inRangeByStatus.cancelled || 0))} cancelled · ${fmtNumber((s.quickRides.inRangeByStatus.expired || 0) + (s.outstationRides.inRangeByStatus.expired || 0))} expired`} />
            <StatCard eyebrow="Open bids right now" value={fmtNumber(s.bids.liveQuick + s.bids.liveOutstation)} caption={`${fmtNumber(s.vehicles.total)} vehicles registered`} />
          </div>

          <div className="mb-7 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHead eyebrow={rangeLabel} title="Rides booked per day" action={<Legend items={[{ label: 'Quick ride', color: RIDE_COLORS.quickride }, { label: 'Outstation', color: RIDE_COLORS.outstation }]} />} />
              <CardBody>
                {series.loading ? (
                  <Spinner />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={days} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="day" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
                        <YAxis allowDecimals={false} {...AXIS} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C5CED9' }} />
                        <Line type="monotone" dataKey="quickRides" name="Quick ride" stroke={RIDE_COLORS.quickride} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                        <Line type="monotone" dataKey="outstationRides" name="Outstation" stroke={RIDE_COLORS.outstation} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHead eyebrow={rangeLabel} title="How rides ended" action={<CardLink to={`/reports?from=${f.from}&to=${f.to}`}>Reports</CardLink>} />
              <CardBody>{statusRows.length ? <BarList rows={statusRows} /> : <p className="text-sm text-ink/45">No rides in this period.</p>}</CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHead eyebrow={rangeLabel} title="New sign-ups per day" action={<Legend items={[{ label: 'Customers', color: SERIES[2] }, { label: 'Drivers', color: SERIES[3] }]} />} />
              <CardBody>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={days} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="day" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
                      <YAxis allowDecimals={false} {...AXIS} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(14,42,71,0.04)' }} />
                      <Bar dataKey="newCustomers" name="Customers" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                      <Bar dataKey="newDrivers" name="Drivers" fill={SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHead eyebrow="All time" title="Vehicles by type" action={can('pricing.edit') && <CardLink to="/vehicle-types">Fares</CardLink>} />
              <CardBody>
                {series.data?.vehicleTypes?.length ? (
                  <BarList rows={series.data.vehicleTypes.map((v) => ({ label: v.name, value: v.count }))} />
                ) : (
                  <p className="text-sm text-ink/45">No vehicles registered yet.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
