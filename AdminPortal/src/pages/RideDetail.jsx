import { Link, useParams } from 'react-router-dom';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { AlertTriangle, ArrowLeft, Info, Radio } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { fmtAgo, fmtDateTime, fmtDecimal, fmtMoney, fmtNumber, shortId } from '../lib/format.js';
import { BaseMap, FitBounds } from '../components/map/BaseMap.jsx';
import { SERIES } from '../components/charts.jsx';
import {
  Badge, Card, CardBody, CardHead, EmptyState, ErrorNote, InfoNote, KeyValues, NotesPanel, PageHead, Person, Spinner,
  Stars, Table,
} from '../components/ui/index.js';

const PATHS = { quickride: '/quick-rides', outstation: '/outstation-rides' };
const LABELS = { quickride: 'Quick ride', outstation: 'Outstation ride' };

const latLng = (point) => {
  const c = point?.coordinates;
  return Array.isArray(c) && c.length === 2 ? [c[1], c[0]] : null;
};

function RouteMap({ ride, live }) {
  const pickup = latLng(ride.pickupCoordinates);
  const drop = latLng(ride.dropCoordinates);
  const driver = live && Number.isFinite(live.latitude) && Number.isFinite(live.longitude) ? [live.latitude, live.longitude] : null;
  const points = [pickup, drop, driver].filter(Boolean);
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <BaseMap className="h-72" center={pickup || undefined} zoom={pickup ? 11 : 5}>
        <FitBounds points={points} trigger={points.length} />
        {pickup && drop && <Polyline positions={[pickup, drop]} pathOptions={{ color: '#0E2A47', weight: 2, opacity: 0.45, dashArray: '6 8' }} />}
        {pickup && (
          <CircleMarker center={pickup} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: SERIES[2], fillOpacity: 1 }}>
            <Tooltip direction="top">Pickup</Tooltip>
          </CircleMarker>
        )}
        {drop && (
          <CircleMarker center={drop} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#E8601A', fillOpacity: 1 }}>
            <Tooltip direction="top">Drop</Tooltip>
          </CircleMarker>
        )}
        {driver && (
          <CircleMarker
            center={driver}
            radius={9}
            pathOptions={{ color: '#fff', weight: 2, fillColor: SERIES[0], fillOpacity: 1, dashArray: live.state === 'online' ? undefined : '3 3' }}
          >
            <Tooltip direction="top">Driver · {live.state === 'online' ? 'live' : 'last known'}</Tooltip>
          </CircleMarker>
        )}
      </BaseMap>
    </div>
  );
}

function Timeline({ steps }) {
  return (
    <ol className="relative space-y-5 pl-6">
      <span className="absolute bottom-1 left-[7px] top-1 w-px bg-line" />
      {steps.map((s) => {
        const bad = s.key === 'cancelled';
        const muted = s.key === 'expired';
        const dot = s.planned
          ? 'border-2 border-dashed border-brand bg-white'
          : bad
          ? 'bg-red-500'
          : muted
          ? 'bg-ink/30'
          : s.key === 'completed'
          ? 'bg-emerald-600'
          : 'bg-brand';
        return (
          <li key={s.key} className="relative">
            <span className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${dot}`} />
            <p className={`text-sm font-medium ${bad ? 'text-red-700' : ''}`}>
              {s.label}
              {s.planned && <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-ink/45">planned</span>}
            </p>
            <p className="text-xs text-ink/50">{s.at ? fmtDateTime(s.at) : 'Time not recorded'}</p>
            {s.note && <p className="mt-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">“{s.note}”</p>}
          </li>
        );
      })}
    </ol>
  );
}

function LivePanel({ live, rideStatus }) {
  if (!live) return null;
  if (live.state === 'offline' || live.state === 'unknown') {
    return (
      <InfoNote icon={Radio}>
        The driver’s app is not reporting a location right now. The ride is <strong>{rideStatus.replace('_', ' ')}</strong>, but no live position is available.
      </InfoNote>
    );
  }
  const isLive = live.state === 'online' && (live.ageSeconds ?? 999) <= 30;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
        isLive ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : 'border-amber-100 bg-amber-50 text-amber-900'
      }`}
    >
      {isLive ? <Radio size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
      <div>
        <p className="font-medium">{isLive ? 'Live location' : 'Last known location'}</p>
        <p className="text-xs opacity-80">
          Updated {fmtAgo(live.updatedAt)} ({fmtDateTime(live.updatedAt)}).
          {!isLive && ' The driver’s app has stopped reporting — this position may be out of date.'}
        </p>
      </div>
    </div>
  );
}

export default function RideDetail({ kind }) {
  const { id } = useParams();
  const { data, error, loading } = useApi(`${PATHS[kind]}/${id}`);

  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <>
        <BackLink kind={kind} />
        <ErrorNote error={error} />
      </>
    );
  }
  const { ride, bids, bidNote, driverVehicle, review, live, timeline } = data;
  const outstation = kind === 'outstation';

  const bidColumns = [
    {
      key: 'driver',
      header: 'Driver',
      sortValue: (b) => b.requestedBy?.name,
      render: (b) =>
        b.requestedBy ? (
          <Person name={b.requestedBy.name} sub={b.requestedBy.phoneNumber} to={`/drivers/${b.requestedBy._id}`} src={b.requestedBy.profileImageUrl} avatar />
        ) : (
          <span className="text-ink/35">Driver removed</span>
        ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      sortValue: (b) => b.vehicleId?.vehicleNumber,
      render: (b) =>
        b.vehicleId ? (
          <div>
            <p className="font-medium num">{b.vehicleId.vehicleNumber}</p>
            <p className="text-xs text-ink/50">{[b.vehicleId.vehicleName, b.vehicleId.vehicleTypeId?.name].filter(Boolean).join(' · ')}</p>
          </div>
        ) : (
          <span className="text-ink/35">—</span>
        ),
    },
    {
      key: 'fare',
      header: 'Bid',
      align: 'right',
      sortable: true,
      render: (b) => {
        const diff = b.fare - ride.offeredFare;
        return (
          <div className="num">
            <p className="font-medium">{fmtMoney(b.fare)}</p>
            <p className="text-[11px] text-ink/45">{diff === 0 ? 'matches offer' : `${diff > 0 ? '+' : '−'}${fmtMoney(Math.abs(diff))} vs offer`}</p>
          </div>
        );
      },
    },
    { key: 'placed', header: 'Placed', sortValue: (b) => b.createdAt, render: (b) => <span className="whitespace-nowrap text-xs">{fmtDateTime(b.createdAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (b) => (b.isAccepted ? 'accepted' : b.requestStatus),
      render: (b) => (b.isAccepted ? <Badge tone="good">Accepted</Badge> : <Badge value={b.requestStatus} />),
    },
  ];

  return (
    <>
      <BackLink kind={kind} />
      <PageHead
        eyebrow={LABELS[kind]}
        title={`Ride ${shortId(ride._id)}`}
        description={`Booked ${fmtDateTime(ride.createdAt)}${outstation ? ` · trip ${fmtDateTime(ride.pickupAt)}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {outstation && <Badge value={ride.bookingType}>{ride.bookingType === 'later' ? 'Scheduled' : 'Now'}</Badge>}
            <Badge value={ride.rideStatus} className="px-3 py-1 text-xs" />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHead eyebrow="Journey" title="Route" />
            <CardBody className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[2] }} />
                  <div>
                    <p className="eyebrow">Pickup</p>
                    <p className="mt-0.5">{ride.pickupLocationName}</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#E8601A' }} />
                  <div>
                    <p className="eyebrow">Drop</p>
                    <p className="mt-0.5">{ride.dropLocationName}</p>
                  </div>
                </div>
              </div>
              <RouteMap ride={ride} live={live && live.state !== 'offline' ? live : null} />
              <KeyValues
                cols={3}
                items={[
                  ['Estimated distance', `${fmtDecimal(ride.estimatedDistanceKm)} km`],
                  ['Estimated duration', `${fmtNumber(Math.round(ride.estimatedDurationMin))} min`],
                  ['Vehicle type', ride.vehicleTypeId?.name],
                ]}
              />
              <LivePanel live={live} rideStatus={ride.rideStatus} />
            </CardBody>
          </Card>

          <Card>
            <CardHead
              eyebrow="Bidding"
              title={`Bids (${bids.length})`}
              action={ride.acceptedBid ? <span className="text-xs text-ink/50">Accepted at {fmtMoney(ride.acceptedBid.fare)}</span> : null}
            />
            <div className="px-5 pt-4">
              <InfoNote icon={Info}>{bidNote}</InfoNote>
            </div>
            <div className="mt-3">
              <Table
                columns={bidColumns}
                rows={bids}
                minWidth="min-w-[640px]"
                empty={<EmptyState title="No bids on record" hint={ride.rideStatus === 'expired' ? 'No driver bid before the ride expired.' : undefined} />}
              />
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Internal" title="Notes" />
            <CardBody>
              <NotesPanel entity={kind} entityId={ride._id} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHead eyebrow="Money" title="Fare" />
            <CardBody>
              <KeyValues
                cols={1}
                items={[
                  ['System suggestion', fmtMoney(ride.suggestedFare)],
                  ['Rider’s offer', fmtMoney(ride.offeredFare)],
                  ['Offer raised', ride.fareUpdateCount ? `${ride.fareUpdateCount} time${ride.fareUpdateCount > 1 ? 's' : ''}` : 'Never'],
                  ['Agreed fare', ride.finalFare != null ? <span className="text-brand-deep">{fmtMoney(ride.finalFare)}</span> : 'Not agreed yet'],
                ]}
              />
              <p className="mt-3 text-[11px] text-ink/45">The agreed fare is what the rider pays the driver — it is not platform revenue.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHead eyebrow="People" title="Customer & driver" />
            <CardBody className="space-y-4">
              <div>
                <p className="eyebrow mb-1.5">Customer</p>
                {ride.bookedBy ? (
                  <div className="flex items-center justify-between gap-3">
                    <Person name={ride.bookedBy.name} sub={ride.bookedBy.phoneNumber} to={`/customers/${ride.bookedBy._id}`} src={ride.bookedBy.profileImageUrl} avatar />
                    {ride.bookedBy.isBlocked && <Badge value="blocked" />}
                  </div>
                ) : (
                  <p className="text-sm text-ink/35">Account removed</p>
                )}
              </div>
              <hr className="border-line" />
              <div>
                <p className="eyebrow mb-1.5">Driver</p>
                {ride.assignedTo ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Person name={ride.assignedTo.name} sub={ride.assignedTo.phoneNumber} to={`/drivers/${ride.assignedTo._id}`} src={ride.assignedTo.profileImageUrl} avatar />
                      {ride.assignedTo.isBlocked && <Badge value="blocked" />}
                    </div>
                    {driverVehicle && (
                      <p className="mt-2 text-xs text-ink/55">
                        <Link to={`/vehicles/${driverVehicle._id}`} className="font-medium text-ink hover:text-brand num">
                          {driverVehicle.vehicleNumber}
                        </Link>
                        {[driverVehicle.vehicleName, driverVehicle.vehicleTypeId?.name].filter(Boolean).length > 0 &&
                          ` · ${[driverVehicle.vehicleName, driverVehicle.vehicleTypeId?.name].filter(Boolean).join(' · ')}`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink/45">No driver assigned</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead eyebrow="Lifecycle" title="Timeline" />
            <CardBody>
              <Timeline steps={timeline} />
              {ride.rideStatus === 'cancelled' && !ride.cancellationReason && (
                <p className="mt-3 text-xs text-ink/45">No cancellation reason was given.</p>
              )}
            </CardBody>
          </Card>

          {review && (
            <Card>
              <CardHead eyebrow="Feedback" title="Rider’s review of this driver" />
              <CardBody>
                <div className="flex items-center justify-between">
                  <Stars value={review.rating} size="text-base" />
                  <span className="text-xs text-ink/45">{fmtDateTime(review.updatedAt || review.createdAt)}</span>
                </div>
                {review.comment ? <p className="mt-2 text-sm text-ink/80">“{review.comment}”</p> : <p className="mt-2 text-sm text-ink/45">No comment.</p>}
                <p className="mt-2 text-[11px] text-ink/45">Reviews are kept per rider–driver pair, so this may cover more than one ride.</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function BackLink({ kind }) {
  return (
    <Link to={PATHS[kind]} className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-brand">
      <ArrowLeft size={13} /> All {kind === 'outstation' ? 'outstation' : 'quick'} rides
    </Link>
  );
}

