import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, ChevronRight, Crosshair, PanelRightClose, PanelRightOpen, Radio, RefreshCw, X } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { RIDE_STATUS_LABEL, fmtAgo, fmtDateTime, fmtMoney, shortId } from '../lib/format.js';
import { BaseMap, MapRef } from '../components/map/BaseMap.jsx';
import { SERIES } from '../components/charts.jsx';
import { Badge, Button, Card, ErrorNote, Input, PageHead, Select, Toggle } from '../components/ui/index.js';

const POLL_MS = 10000;

// Marker styling per state. Colour carries state; the panel and legend repeat it in words.
const STYLE = {
  available: { fillColor: SERIES[2], color: '#fff', weight: 2, fillOpacity: 0.95 },
  on_trip: { fillColor: SERIES[0], color: '#fff', weight: 2, fillOpacity: 0.95 },
  disconnected: { fillColor: '#94A3B8', color: '#64748B', weight: 1.5, dashArray: '3 3', fillOpacity: 0.45 },
  searching: { fillColor: '#E8601A', color: '#fff', weight: 2, fillOpacity: 0.95 },
  active: { fillColor: '#fff', color: '#0E2A47', weight: 2.5, fillOpacity: 1 },
};

const STATE_LABEL = { available: 'Available', on_trip: 'On a trip', disconnected: 'Disconnected' };

const pos = (p) => (p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? [p.latitude, p.longitude] : null);
const ridePath = (r) => (r.rideType === 'outstation' ? '/outstation-rides' : '/quick-rides');

function Legend() {
  const dot = (s, label) => (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: STYLE[s].fillColor, border: `1.5px ${STYLE[s].dashArray ? 'dashed' : 'solid'} ${STYLE[s].color}` }}
      />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
      {dot('available', 'Available driver')}
      {dot('on_trip', 'Driver on a trip')}
      {dot('disconnected', 'Disconnected (last known)')}
      {dot('searching', 'Ride looking for a driver')}
      {dot('active', 'Active ride pickup')}
    </div>
  );
}

function Count({ label, value, tone }) {
  return (
    <div className="px-5 py-3">
      <p className="text-[11px] uppercase tracking-wider text-ink/50">{label}</p>
      <p className={`mt-1 font-display text-3xl leading-none num ${value ? tone || '' : 'text-ink/25'}`}>{value}</p>
    </div>
  );
}

function FreshnessNote({ isStale, updatedAt, disconnected }) {
  if (!isStale) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700">
        <Radio size={13} /> Live · updated {fmtAgo(updatedAt)}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>
        <strong>Last known location</strong>, updated {fmtAgo(updatedAt)}.{' '}
        {disconnected ? 'The app disconnected; the driver has a few minutes to reconnect before going offline.' : 'The app has stopped sending updates.'}
      </span>
    </div>
  );
}

function DriverPanel({ d, ride }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Driver</p>
        <Link to={`/drivers/${d.driverId}`} className="mt-1 block font-display text-xl leading-tight hover:text-brand">
          {d.name || 'Unnamed driver'}
        </Link>
        <p className="text-xs text-ink/50 num">ID {shortId(d.driverId)}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge value={d.state}>{STATE_LABEL[d.state]}</Badge>
        {d.vehicleTypeName && <Badge tone="muted">{d.vehicleTypeName}</Badge>}
      </div>
      <FreshnessNote isStale={d.isStale} updatedAt={d.updatedAt} disconnected={d.state === 'disconnected'} />
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Vehicle</dt>
          <dd className="font-medium num">{d.vehicleNumber || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Position</dt>
          <dd className="font-medium num">
            {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Last update</dt>
          <dd className="font-medium">{fmtDateTime(d.updatedAt)}</dd>
        </div>
      </dl>
      {d.ride && (
        <div className="rounded-md border border-line bg-mist/60 px-3 py-2.5 text-sm">
          <p className="eyebrow mb-1">Assigned ride</p>
          <Link to={`${ridePath(d.ride)}/${d.ride.rideId}`} className="flex items-center justify-between gap-2 font-medium hover:text-brand">
            <span>
              {d.ride.rideType === 'outstation' ? 'Outstation' : 'Quick ride'} {shortId(d.ride.rideId)}
            </span>
            <ChevronRight size={14} />
          </Link>
          <p className="mt-0.5 text-xs text-ink/55">{RIDE_STATUS_LABEL[d.ride.rideStatus]}</p>
          {ride && <p className="mt-1.5 text-xs text-ink/60">{ride.pickupLocationName} → {ride.dropLocationName}</p>}
        </div>
      )}
      <Link to={`/drivers/${d.driverId}`} className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-deep">
        Open driver profile (contact details) <ChevronRight size={13} />
      </Link>
    </div>
  );
}

function RidePanel({ r }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">{r.rideType === 'outstation' ? 'Outstation ride' : 'Quick ride'}</p>
        <Link to={`${ridePath(r)}/${r._id}`} className="mt-1 block font-display text-xl leading-tight hover:text-brand">
          Ride {shortId(r._id)}
        </Link>
        <p className="text-xs text-ink/50">Booked {fmtDateTime(r.createdAt)}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge value={r.rideStatus} />
        {r.vehicleType && <Badge tone="muted">{r.vehicleType.name}</Badge>}
      </div>
      <div className="space-y-1.5 text-sm">
        <p>
          <span className="eyebrow mr-1.5">From</span>
          {r.pickupLocationName}
        </p>
        <p>
          <span className="eyebrow mr-1.5">To</span>
          {r.dropLocationName}
        </p>
        {r.pickupAt && r.rideType === 'outstation' && (
          <p>
            <span className="eyebrow mr-1.5">Trip</span>
            {fmtDateTime(r.pickupAt)}
          </p>
        )}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Customer</dt>
          <dd className="text-right font-medium">
            {r.customer ? (
              <Link to={`/customers/${r.customer._id}`} className="hover:text-brand">
                {r.customer.name}
                <span className="block text-xs font-normal text-ink/50 num">{r.customer.phoneNumber}</span>
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Driver</dt>
          <dd className="text-right font-medium">
            {r.driver ? (
              <Link to={`/drivers/${r.driver._id}`} className="hover:text-brand">
                {r.driver.name}
                <span className="block text-xs font-normal text-ink/50 num">{r.driver.phoneNumber}</span>
              </Link>
            ) : (
              <span className="text-ink/45">Not assigned</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Fare</dt>
          <dd className="font-medium num">{fmtMoney(r.finalFare ?? r.offeredFare)}</dd>
        </div>
      </dl>
      {r.driver &&
        (r.driverPosition ? (
          <FreshnessNote isStale={r.driverPosition.isStale} updatedAt={r.driverPosition.updatedAt} />
        ) : (
          <p className="text-xs text-ink/50">The driver’s app is not reporting a location.</p>
        ))}
      <Link to={`${ridePath(r)}/${r._id}`} className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-deep">
        Open ride details <ChevronRight size={13} />
      </Link>
    </div>
  );
}

export default function LiveMap() {
  const [layers, setLayers] = useState({ available: true, on_trip: true, disconnected: true, searching: true, active: true });
  const [rideType, setRideType] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // { kind: 'driver'|'ride', id }
  const [panelOpen, setPanelOpen] = useState(true);
  const mapRef = useRef(null);
  const fittedOnce = useRef(false);

  const drivers = useApi('/live/drivers', undefined, { interval: POLL_MS });
  const rides = useApi('/live/rides', undefined, { interval: POLL_MS });
  const { data: types } = useApi('/vehicle-types');

  const q = search.trim().toLowerCase();
  const ridesById = useMemo(() => new Map((rides.data?.data || []).map((r) => [String(r._id), r])), [rides.data]);

  const visibleDrivers = useMemo(
    () =>
      (drivers.data?.data || []).filter((d) => {
        if (!layers[d.state]) return false;
        if (vehicleTypeId && d.vehicleTypeId !== vehicleTypeId) return false;
        if (rideType && d.state === 'on_trip' && d.ride?.rideType !== rideType) return false;
        // Idle drivers can take either product, so a ride-type filter only narrows drivers on a trip.
        if (q && ![d.name, d.vehicleNumber, d.driverId, d.ride?.rideId].some((v) => String(v || '').toLowerCase().includes(q))) return false;
        return true;
      }),
    [drivers.data, layers, vehicleTypeId, rideType, q]
  );

  const visibleRides = useMemo(
    () =>
      (rides.data?.data || []).filter((r) => {
        const layer = r.rideStatus === 'searching' ? 'searching' : 'active';
        if (!layers[layer]) return false;
        if (rideType && r.rideType !== rideType) return false;
        if (vehicleTypeId && String(r.vehicleType?._id) !== vehicleTypeId) return false;
        if (
          q &&
          ![r._id, r.customer?.name, r.driver?.name, r.pickupLocationName, r.dropLocationName].some((v) => String(v || '').toLowerCase().includes(q))
        )
          return false;
        return true;
      }),
    [rides.data, layers, rideType, vehicleTypeId, q]
  );

  const allPoints = useMemo(
    () => [...visibleDrivers.map((d) => [d.latitude, d.longitude]), ...visibleRides.map((r) => pos(r.pickup)).filter(Boolean)],
    [visibleDrivers, visibleRides]
  );

  const fit = useCallback(
    (points = allPoints) => {
      const map = mapRef.current;
      if (!map || !points.length) return;
      if (points.length === 1) map.setView(points[0], 14);
      else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    },
    [allPoints]
  );

  const onMap = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // First time data arrives, frame it.
  useEffect(() => {
    if (fittedOnce.current || !mapRef.current || !allPoints.length || !drivers.data || !rides.data) return;
    fittedOnce.current = true;
    fit(allPoints);
  }, [allPoints, drivers.data, rides.data, fit]);

  const counts = useMemo(() => {
    const c = { available: 0, on_trip: 0, disconnected: 0, searching: 0, active: 0 };
    (drivers.data?.data || []).forEach((d) => {
      c[d.state] += 1;
    });
    (rides.data?.data || []).forEach((r) => {
      c[r.rideStatus === 'searching' ? 'searching' : 'active'] += 1;
    });
    return c;
  }, [drivers.data, rides.data]);

  const selDriver = selected?.kind === 'driver' ? (drivers.data?.data || []).find((d) => d.driverId === selected.id) : null;
  const selRide = selected?.kind === 'ride' ? ridesById.get(selected.id) : null;

  const select = (kind, id, point) => {
    setSelected({ kind, id });
    setPanelOpen(true);
    if (point && mapRef.current) mapRef.current.panTo(point);
  };

  const loading = (drivers.loading && !drivers.data) || (rides.loading && !rides.data);
  const nobody = !loading && !(drivers.data?.data || []).length && !(rides.data?.data || []).length;
  const updatedAt = drivers.data?.generatedAt;

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Live operations"
        description="Drivers with the app open and rides in motion, refreshed every 10 seconds. A grey dashed marker is a last known position, not a live one."
        action={
          <>
            <span className="self-center text-xs text-ink/45">{updatedAt ? `Updated ${fmtAgo(updatedAt)}` : ''}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                drivers.reload(true);
                rides.reload(true);
              }}
            >
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fit()} disabled={!allPoints.length}>
              <Crosshair size={14} /> Fit to markers
            </Button>
          </>
        }
      />

      <div className="mb-5 overflow-hidden rounded-lg border border-line bg-mist">
        <div className="grid grid-cols-2 divide-line sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
          <Count label="Available drivers" value={counts.available} tone="text-brand-deep" />
          <Count label="Drivers on a trip" value={counts.on_trip} tone="text-brand-deep" />
          <Count label="Disconnected" value={counts.disconnected} />
          <Count label="Rides searching" value={counts.searching} tone="text-brand-deep" />
          <Count label="Active rides" value={counts.active} tone="text-brand-deep" />
        </div>
      </div>

      <ErrorNote error={drivers.error || rides.error} className="mb-4" />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-mist/60 px-5 py-3">
          <Input className="w-52" placeholder="Driver, vehicle no. or ride id" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select
            className="w-40"
            placeholder="Both ride types"
            value={rideType}
            onChange={(e) => setRideType(e.target.value)}
            options={[
              { value: 'quickride', label: 'Quick rides' },
              { value: 'outstation', label: 'Outstation' },
            ]}
          />
          <Select
            className="w-40"
            placeholder="Any vehicle"
            value={vehicleTypeId}
            onChange={(e) => setVehicleTypeId(e.target.value)}
            options={(types?.data || []).map((t) => ({ value: t._id, label: t.name }))}
          />
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <Toggle checked={layers.available} onChange={(v) => setLayers((l) => ({ ...l, available: v }))} label="Available" />
            <Toggle checked={layers.on_trip} onChange={(v) => setLayers((l) => ({ ...l, on_trip: v }))} label="On trip" />
            <Toggle checked={layers.disconnected} onChange={(v) => setLayers((l) => ({ ...l, disconnected: v }))} label="Last known" />
            <Toggle checked={layers.searching} onChange={(v) => setLayers((l) => ({ ...l, searching: v }))} label="Searching" />
            <Toggle checked={layers.active} onChange={(v) => setLayers((l) => ({ ...l, active: v }))} label="Active rides" />
          </div>
        </div>

        <div className="flex">
          <div className="relative min-w-0 flex-1">
            <BaseMap className="h-[calc(100vh-22rem)] min-h-[28rem]">
              <MapRef onMap={onMap} />
              {visibleRides
                .filter((r) => r.rideStatus !== 'searching' && pos(r.pickup) && pos(r.drop))
                .map((r) => (
                  <Polyline
                    key={`line-${r._id}`}
                    positions={[pos(r.pickup), pos(r.drop)]}
                    pathOptions={{ color: '#0E2A47', weight: 1.5, opacity: 0.35, dashArray: '4 6' }}
                  />
                ))}
              {visibleRides.map((r) => {
                const p = pos(r.pickup);
                if (!p) return null;
                const isSel = selected?.kind === 'ride' && selected.id === String(r._id);
                return (
                  <CircleMarker
                    key={`ride-${r._id}`}
                    center={p}
                    radius={isSel ? 10 : 7}
                    pathOptions={STYLE[r.rideStatus === 'searching' ? 'searching' : 'active']}
                    eventHandlers={{ click: () => select('ride', String(r._id), p) }}
                  >
                    <Tooltip direction="top">
                      {r.rideStatus === 'searching' ? 'Looking for a driver' : RIDE_STATUS_LABEL[r.rideStatus]} · {shortId(r._id)}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
              {visibleDrivers.map((d) => {
                const isSel = selected?.kind === 'driver' && selected.id === d.driverId;
                return (
                  <CircleMarker
                    key={`drv-${d.driverId}`}
                    center={[d.latitude, d.longitude]}
                    radius={isSel ? 11 : 8}
                    pathOptions={{ ...STYLE[d.state], ...(isSel && { color: '#0E2A47', weight: 3 }) }}
                    eventHandlers={{ click: () => select('driver', d.driverId, [d.latitude, d.longitude]) }}
                  >
                    <Tooltip direction="top">
                      {d.name || 'Driver'} · {STATE_LABEL[d.state]}
                      {d.isStale ? ` · last seen ${fmtAgo(d.updatedAt)}` : ''}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </BaseMap>
            {nobody && (
              <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
                <div className="pointer-events-auto rounded-lg border border-line bg-white/95 px-6 py-5 text-center shadow-card">
                  <p className="font-display text-lg">Nobody is on the road right now</p>
                  <p className="mt-1 text-sm text-ink/55">Drivers appear when they go online in the app; rides appear as soon as they are booked.</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className="absolute right-3 top-3 z-[500] rounded-md border border-line bg-white p-1.5 text-ink/60 shadow-card hover:text-ink"
              aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
            >
              {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>

          {panelOpen && (
            <aside className="hidden w-80 shrink-0 flex-col border-l border-line lg:flex" style={{ maxHeight: 'max(28rem, calc(100vh - 22rem))' }}>
              {selDriver || selRide ? (
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <button onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 text-xs text-ink/50 hover:text-brand">
                    <X size={13} /> Back to list
                  </button>
                  {selDriver ? <DriverPanel d={selDriver} ride={selDriver.ride ? ridesById.get(String(selDriver.ride.rideId)) : null} /> : <RidePanel r={selRide} />}
                </div>
              ) : (
                <ListPanel drivers={visibleDrivers} rides={visibleRides} onDriver={(d) => select('driver', d.driverId, [d.latitude, d.longitude])} onRide={(r) => select('ride', String(r._id), pos(r.pickup))} />
              )}
            </aside>
          )}
        </div>
        <div className="border-t border-line px-5 py-3">
          <Legend />
        </div>
      </Card>

      {/* Below lg the side panel moves under the map. */}
      {(selDriver || selRide) && (
        <Card className="mt-5 lg:hidden">
          <div className="px-5 py-4">
            <button onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 text-xs text-ink/50 hover:text-brand">
              <X size={13} /> Close
            </button>
            {selDriver ? <DriverPanel d={selDriver} ride={selDriver.ride ? ridesById.get(String(selDriver.ride.rideId)) : null} /> : <RidePanel r={selRide} />}
          </div>
        </Card>
      )}
    </>
  );
}

function ListPanel({ drivers, rides, onDriver, onRide }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <p className="eyebrow sticky top-0 border-b border-line bg-white px-5 py-2.5">Rides ({rides.length})</p>
      <ul>
        {rides.slice(0, 100).map((r) => (
          <li key={r._id}>
            <button onClick={() => onRide(r)} className="w-full border-b border-line/70 px-5 py-2.5 text-left hover:bg-mist">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium num">{shortId(r._id)}</span>
                <Badge value={r.rideStatus} />
              </div>
              <p className="mt-0.5 truncate text-xs text-ink/50">{r.pickupLocationName}</p>
            </button>
          </li>
        ))}
        {!rides.length && <li className="px-5 py-3 text-xs text-ink/45">No rides in view.</li>}
      </ul>
      <p className="eyebrow sticky top-0 border-b border-line bg-white px-5 py-2.5">Drivers ({drivers.length})</p>
      <ul>
        {drivers.slice(0, 200).map((d) => (
          <li key={d.driverId}>
            <button onClick={() => onDriver(d)} className="w-full border-b border-line/70 px-5 py-2.5 text-left hover:bg-mist">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{d.name || 'Unnamed driver'}</span>
                <Badge value={d.state}>{STATE_LABEL[d.state]}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink/50">
                <span className="num">{d.vehicleNumber || '—'}</span> · {d.isStale ? `last seen ${fmtAgo(d.updatedAt)}` : 'live'}
              </p>
            </button>
          </li>
        ))}
        {!drivers.length && <li className="px-5 py-3 text-xs text-ink/45">No drivers in view.</li>}
      </ul>
    </div>
  );
}
