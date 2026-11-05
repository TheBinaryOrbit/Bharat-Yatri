import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useApi, useDebounced, useUrlFilters, useUrlSort } from '../lib/hooks.js';
import { RIDE_STATUS_LABEL, fmtDateTime, fmtMoney, shortId } from '../lib/format.js';
import {
  Badge, Button, Card, DateRange, ErrorNote, Input, PageHead, Pagination, Person, Select, Table, Toolbar, EmptyState,
} from '../components/ui/index.js';

const STATUSES = {
  quickride: ['searching', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'],
  outstation: ['searching', 'assigned', 'arriving', 'in_progress', 'completed', 'cancelled', 'expired'],
};

const COPY = {
  quickride: {
    title: 'Quick rides',
    path: '/quick-rides',
    description: 'City rides booked for now. Drivers bid within a minute; unclaimed rides expire after five.',
  },
  outstation: {
    title: 'Outstation rides',
    path: '/outstation-rides',
    description: 'Long-distance trips, booked for now or scheduled ahead. Bids stay open until the rider accepts one.',
  },
};

export default function Rides({ kind }) {
  const copy = COPY[kind];
  const navigate = useNavigate();
  const [f, setF, clear] = useUrlFilters({ page: '1', limit: '20' });
  const [search, setSearch] = useState(f.q || '');
  const q = useDebounced(search);

  useEffect(() => {
    if ((f.q || '') !== q) setF({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Reset the search box when switching between the two ride kinds.
  useEffect(() => {
    setSearch(f.q || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const sortProps = useUrlSort(f, setF);
  const { data: types } = useApi('/vehicle-types');
  const { data, error, loading } = useApi(copy.path, {
    sortBy: f.sortBy,
    order: f.order,
    page: f.page,
    limit: f.limit,
    q: f.q,
    status: f.status,
    vehicleTypeId: f.vehicleTypeId,
    from: f.from,
    to: f.to,
    ...(kind === 'outstation' && { bookingType: f.bookingType, tripFrom: f.tripFrom, tripTo: f.tripTo }),
  });

  const filtered = ['q', 'status', 'vehicleTypeId', 'from', 'to', 'bookingType', 'tripFrom', 'tripTo'].some((k) => f[k]);

  const columns = [
    {
      key: 'ride',
      header: 'Ride',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium num">{shortId(r._id)}</p>
          <p className="text-xs text-ink/50">{fmtDateTime(r.createdAt)}</p>
        </div>
      ),
    },
    ...(kind === 'outstation'
      ? [
          {
            key: 'pickupAt',
            header: 'Trip',
            sortable: true,
            render: (r) => (
              <div>
                <p className="whitespace-nowrap">{fmtDateTime(r.pickupAt)}</p>
                <Badge value={r.bookingType} className="mt-0.5">
                  {r.bookingType === 'later' ? 'Scheduled' : 'Now'}
                </Badge>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'customer',
      header: 'Customer',
      render: (r) =>
        r.bookedBy ? <Person name={r.bookedBy.name} sub={r.bookedBy.phoneNumber} to={`/customers/${r.bookedBy._id}`} /> : <span className="text-ink/35">—</span>,
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (r) =>
        r.assignedTo ? (
          <Person name={r.assignedTo.name} sub={r.assignedTo.phoneNumber} to={`/drivers/${r.assignedTo._id}`} />
        ) : (
          <span className="text-ink/35">Unassigned</span>
        ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div className="max-w-[18rem] text-xs leading-relaxed">
          <p className="truncate" title={r.pickupLocationName}>
            {r.pickupLocationName}
          </p>
          <p className="flex items-center gap-1 truncate text-ink/50" title={r.dropLocationName}>
            <ArrowRight size={11} className="shrink-0 text-brand" />
            <span className="truncate">{r.dropLocationName}</span>
          </p>
        </div>
      ),
    },
    { key: 'type', header: 'Vehicle', render: (r) => r.vehicleTypeId?.name || <span className="text-ink/35">—</span> },
    {
      key: 'fare',
      header: 'Fare',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div className="num">
          <p className="font-medium">{fmtMoney(r.finalFare ?? r.offeredFare)}</p>
          <p className="text-[11px] text-ink/45">{r.finalFare != null ? `offered ${fmtMoney(r.offeredFare)}` : 'offered'}</p>
        </div>
      ),
    },
    { key: 'bids', header: 'Bids', align: 'right', render: (r) => <span className={`num ${r.bidCount ? '' : 'text-ink/35'}`}>{r.bidCount}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge value={r.rideStatus} /> },
  ];

  return (
    <>
      <PageHead eyebrow="Rides" title={copy.title} description={copy.description} />
      <Card>
        <Toolbar>
          <Input className="w-52" placeholder="Ride id, person or place" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select
            className="w-40"
            placeholder="Every status"
            value={f.status || ''}
            onChange={(e) => setF({ status: e.target.value })}
            options={STATUSES[kind].map((s) => ({ value: s, label: RIDE_STATUS_LABEL[s] }))}
          />
          <Select
            className="w-40"
            placeholder="Any vehicle"
            value={f.vehicleTypeId || ''}
            onChange={(e) => setF({ vehicleTypeId: e.target.value })}
            options={(types?.data || []).map((t) => ({ value: t._id, label: t.name }))}
          />
          {kind === 'outstation' && (
            <Select
              className="w-32"
              placeholder="Any booking"
              value={f.bookingType || ''}
              onChange={(e) => setF({ bookingType: e.target.value })}
              options={[
                { value: 'now', label: 'Now' },
                { value: 'later', label: 'Scheduled' },
              ]}
            />
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink/50">Booked</span>
            <DateRange from={f.from} to={f.to} onChange={({ from, to }) => setF({ from, to })} />
          </div>
          {kind === 'outstation' && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="text-xs text-ink/50">Trip date</span>
              <DateRange presets={false} from={f.tripFrom} to={f.tripTo} onChange={({ from, to }) => setF({ tripFrom: from, tripTo: to })} />
            </div>
          )}
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                clear();
              }}
            >
              <X size={14} /> Clear filters
            </Button>
          )}
        </Toolbar>
        {error && <ErrorNote error={error} className="m-4" />}
        <Table
          {...sortProps}
          columns={columns}
          rows={data?.data}
          loading={loading && !data}
          onRowClick={(r) => navigate(`${copy.path}/${r._id}`)}
          minWidth="min-w-[980px]"
          empty={
            <EmptyState
              title={filtered ? 'No rides match these filters' : 'No rides yet'}
              hint={filtered ? 'Try a wider date range or clear the filters.' : 'Rides appear here as soon as riders book them.'}
            />
          }
        />
        <Pagination
          page={data?.page || 1}
          pages={data?.pages || 1}
          total={data?.total || 0}
          limit={Number(f.limit)}
          onPage={(p) => setF({ page: p }, { resetPage: false })}
          onLimit={(l) => setF({ limit: l })}
        />
      </Card>
    </>
  );
}
