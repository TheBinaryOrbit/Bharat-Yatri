import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi, useDebounced, useUrlFilters } from '../lib/hooks.js';
import { daysAgo, fmtDate, fmtDateTime, fmtNumber, fmtPercent, isoDay } from '../lib/format.js';
import {
  Badge, Card, CardBody, CardHead, DateRange, ErrorNote, Input, PageHead, Pagination, Select, StatCard, Table, Toolbar,
} from '../components/ui/index.js';
import { AXIS, ChartTooltip, GRID, Legend, SERIES, shortDay } from '../components/charts.jsx';

export default function InstallReferrers() {
  const [f, setF] = useUrlFilters({ from: daysAgo(29), to: isoDay(), app: '', source: '', medium: '', campaign: '', linked: '', page: '1', limit: '50' });
  const [search, setSearch] = useState({ source: f.source, medium: f.medium, campaign: f.campaign });
  const debounced = useDebounced(search);
  // Keep the URL in step with the debounced text boxes.
  useEffect(() => {
    if (debounced.source !== f.source || debounced.medium !== f.medium || debounced.campaign !== f.campaign) setF(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const range = { from: f.from, to: f.to, app: f.app };
  const page = Number(f.page) || 1;
  const limit = Number(f.limit) || 50;

  const summary = useApi('/install-referrers/summary', range);
  const series = useApi('/install-referrers/timeseries', range);
  const list = useApi('/install-referrers', {
    ...range, source: f.source, medium: f.medium, campaign: f.campaign, linked: f.linked, limit, skip: (page - 1) * limit,
  });

  const s = summary.data;
  const total = list.data?.total || 0;

  return (
    <>
      <PageHead
        eyebrow="Acquisition"
        title="Install referrers"
        description="Where installs came from (Play install referrer / UTM), and how many went on to sign up on that device."
        action={<DateRange from={f.from} to={f.to} onChange={({ from, to }) => setF({ from, to })} />}
      />
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Select
          className="w-40"
          value={f.app}
          onChange={(e) => setF({ app: e.target.value })}
          placeholder="Both apps"
          options={[{ value: 'driver', label: 'Driver app' }, { value: 'user', label: 'Rider app' }]}
        />
        <p className="text-xs text-ink/45">
          {fmtDate(f.from)} – {fmtDate(f.to)} · IST, by install time
        </p>
      </div>
      <ErrorNote error={summary.error || series.error} className="mb-4" />
      <div className="mb-5 grid gap-5 sm:grid-cols-3">
        <StatCard eyebrow="Installs" value={fmtNumber(s?.totalInstalls)} caption="In the window" />
        <StatCard eyebrow="Signed up" value={fmtNumber(s?.totalSignups)} caption="Install linked to an account" />
        <StatCard eyebrow="Conversion" value={fmtPercent(s?.totalInstalls ? s.totalSignups / s.totalInstalls : null, 1)} caption="Sign-ups ÷ installs" tone="brand" />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead
            eyebrow="Per day"
            title="Installs and sign-ups"
            action={<Legend items={[{ label: 'Installs', color: SERIES[0] }, { label: 'Sign-ups', color: SERIES[1] }]} />}
          />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={series.data?.days || []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="day" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C5CED9' }} />
                  <Line dataKey="installs" name="Installs" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
                  <Line dataKey="signups" name="Sign-ups" stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHead eyebrow="Breakdown" title="By source & medium" />
          <Table
            minWidth="min-w-[420px]"
            loading={summary.loading}
            rowKey={(r) => `${r.source}/${r.medium}`}
            onRowClick={(r) => {
              setSearch((x) => ({ ...x, source: r.source === 'unknown' ? '' : r.source, medium: r.medium === 'unknown' ? '' : r.medium }));
            }}
            columns={[
              { key: 'source', header: 'Source', render: (r) => <span className="font-medium">{r.source}</span> },
              { key: 'medium', header: 'Medium', render: (r) => <span className="text-ink/60">{r.medium}</span> },
              { key: 'installs', header: 'Installs', align: 'right', render: (r) => fmtNumber(r.installs) },
              { key: 'signups', header: 'Sign-ups', align: 'right', render: (r) => `${fmtNumber(r.signups)} · ${fmtPercent(r.installs ? r.signups / r.installs : null)}` },
            ]}
            rows={s?.data || []}
          />
        </Card>
      </div>
      <Card>
        <CardHead eyebrow={`${fmtNumber(total)} installs`} title="Every install" />
        <Toolbar>
          <Input className="w-36" placeholder="Source" value={search.source} onChange={(e) => setSearch((x) => ({ ...x, source: e.target.value }))} />
          <Input className="w-36" placeholder="Medium" value={search.medium} onChange={(e) => setSearch((x) => ({ ...x, medium: e.target.value }))} />
          <Input className="w-44" placeholder="Campaign (exact)" value={search.campaign} onChange={(e) => setSearch((x) => ({ ...x, campaign: e.target.value }))} />
          <Select
            className="w-40"
            value={f.linked}
            onChange={(e) => setF({ linked: e.target.value })}
            placeholder="Signed up or not"
            options={[{ value: 'true', label: 'Signed up' }, { value: 'false', label: 'Not signed up' }]}
          />
        </Toolbar>
        <ErrorNote error={list.error} className="m-4" />
        <Table
          loading={list.loading}
          columns={[
            { key: 'installTime', header: 'Installed', render: (r) => <span className="whitespace-nowrap text-ink/70">{fmtDateTime(r.installTime)}</span> },
            { key: 'app', header: 'App', render: (r) => <Badge value={r.app} /> },
            {
              key: 'source',
              header: 'Source / medium',
              render: (r) => (
                <span>
                  <span className="font-medium">{r.source || 'unknown'}</span>
                  <span className="text-ink/50"> / {r.medium || 'unknown'}</span>
                </span>
              ),
            },
            { key: 'campaign', header: 'Campaign', render: (r) => r.campaign || <span className="text-ink/35">—</span> },
            { key: 'platform', header: 'Platform', render: (r) => <span className="text-ink/60">{r.platform}{r.appVersion ? ` · v${r.appVersion}` : ''}</span> },
            {
              key: 'account',
              header: 'Signed up as',
              render: (r) =>
                r.driverId ? (
                  <Link to={`/drivers/${r.driverId._id}`} className="font-medium hover:text-brand">{r.driverId.name || 'Driver'}</Link>
                ) : r.userId ? (
                  <Link to={`/customers/${r.userId._id}`} className="font-medium hover:text-brand">{r.userId.name || 'Rider'}</Link>
                ) : (
                  <span className="text-ink/35">Not yet</span>
                ),
            },
          ]}
          rows={list.data?.data || []}
        />
        <Pagination
          page={page}
          pages={Math.max(Math.ceil(total / limit), 1)}
          total={total}
          limit={limit}
          onPage={(p) => setF({ page: p }, { resetPage: false })}
          onLimit={(l) => setF({ limit: l })}
        />
      </Card>
    </>
  );
}
