import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Radio, Trash2, Wallet } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtAgo, fmtDate, fmtDateTime, fmtMoney, fmtNumber, shortId, titleCase } from '../lib/format.js';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, Confirm, DocThumb, EmptyState, ErrorNote, InfoNote, KeyValues, NotesPanel, PageHead,
  Pagination, Person, Select, Spinner, StatCard, StatRow, Stars, Table, Tabs, useToast,
} from '../components/ui/index.js';
import { ChangeKycStatus } from '../components/people/ChangeKycStatus.jsx';
import { EditDriverProfile } from '../components/people/EditDriverProfile.jsx';
import { AccountStatus, BackLink, BlockAction, BlockedBanner, InsuranceBadge, RideHistory, RideLink } from '../components/people/shared.jsx';

function LiveChip({ live }) {
  if (!live || live.state === 'offline') return <Badge tone="muted">Offline</Badge>;
  if (live.state === 'unknown') return <Badge tone="muted">Live status unavailable</Badge>;
  const fresh = live.state === 'online';
  return (
    <Badge tone={fresh ? 'good' : 'warn'}>
      <Radio size={11} /> {fresh ? 'Online' : 'Disconnected'} · {fmtAgo(live.updatedAt)}
    </Badge>
  );
}

function ReviewsSection({ driverId, rating }) {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [stars, setStars] = useState('');
  const [removing, setRemoving] = useState(null);
  const { data, loading, error, reload } = useApi(`/drivers/${driverId}/reviews`, { page, limit: 10, rating: stars });
  const max = Math.max(...Object.values(rating.distribution), 1);

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <Card>
        <CardHead eyebrow="Rating" title="From riders" />
        <CardBody>
          <p className="font-display text-5xl leading-none num">{rating.average != null ? rating.average.toFixed(1) : '—'}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-ink/45">{fmtNumber(rating.count)} reviews · out of 5</p>
          <ul className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n}>
                <button type="button" onClick={() => { setStars(stars === String(n) ? '' : String(n)); setPage(1); }} className="group flex w-full items-center gap-2 text-xs" title={`Show ${n}-star reviews`}>
                  <span className={`w-6 text-left num ${stars === String(n) ? 'font-semibold text-brand' : 'text-ink/55'}`}>{n}★</span>
                  <span className="h-1.5 flex-1 rounded-full bg-mist">
                    <span className="block h-1.5 rounded-full bg-brand-soft group-hover:bg-brand" style={{ width: `${(rating.distribution[n] / max) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-ink/50 num">{rating.distribution[n]}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHead
          eyebrow="Reviews"
          title={stars ? `${stars}-star reviews` : 'All reviews'}
          action={
            <Select className="w-32" value={stars} onChange={(e) => { setStars(e.target.value); setPage(1); }} placeholder="Any rating" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} stars` }))} />
          }
        />
        {error && <ErrorNote error={error} className="m-4" />}
        {loading && !data ? (
          <Spinner />
        ) : data?.data?.length ? (
          <ul className="divide-y divide-line">
            {data.data.map((r) => (
              <li key={r._id} className="flex items-start gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    {r.userId ? (
                      <Link to={`/customers/${r.userId._id}`} className="text-sm font-medium hover:text-brand">{r.userId.name}</Link>
                    ) : (
                      <span className="text-sm text-ink/45">Customer removed</span>
                    )}
                    <span className="text-[11px] text-ink/40">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.comment ? <p className="mt-1 text-sm text-ink/75">{r.comment}</p> : <p className="mt-1 text-xs text-ink/35">No comment</p>}
                </div>
                {can('reviews.moderate') && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(r)} aria-label="Remove review">
                    <Trash2 size={14} /> Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12">
            <EmptyState title="No reviews" hint={stars ? 'No reviews with this rating.' : 'Riders have not reviewed this driver yet.'} />
          </div>
        )}
        {data && data.total > 10 && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />}
      </Card>
      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this review?"
        confirmLabel="Remove review"
        reason
        reasonPlaceholder="Which moderation rule it breaks"
        onConfirm={async (reason) => {
          await api.del(`/drivers/${driverId}/reviews/${removing._id}`, { reason });
          toast('Review removed');
          reload();
        }}
      >
        <p>The review is deleted and the driver’s average rating is recalculated. A copy is kept in the audit log.</p>
        {removing?.comment && <blockquote className="border-l-2 border-line pl-3 italic text-ink/60">“{removing.comment}”</blockquote>}
      </Confirm>
    </div>
  );
}

function BidsSection({ driverId }) {
  const navigate = useNavigate();
  const [rideType, setRideType] = useState('quickride');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi(`/drivers/${driverId}/bids`, { rideType, page, limit: 10 });
  const base = rideType === 'outstation' ? '/outstation-rides' : '/quick-rides';

  const columns = [
    { key: 'ride', header: 'Ride', render: (b) => (b.ride ? <RideLink type={rideType} id={b.ride._id} /> : <span className="text-ink/35">Removed</span>) },
    {
      key: 'route',
      header: 'Route',
      render: (b) =>
        b.ride ? (
          <span className="block max-w-[18rem]">
            <span className="block truncate">{b.ride.pickupLocationName}</span>
            <span className="block truncate text-xs text-ink/50">→ {b.ride.dropLocationName}</span>
          </span>
        ) : '—',
    },
    { key: 'offered', header: 'Rider offered', align: 'right', render: (b) => fmtMoney(b.ride?.offeredFare) },
    { key: 'fare', header: 'Bid', align: 'right', render: (b) => <span className="font-medium">{fmtMoney(b.fare)}</span> },
    { key: 'status', header: 'Bid status', render: (b) => <Badge value={b.requestStatus} /> },
    { key: 'ridestatus', header: 'Ride status', render: (b) => (b.ride ? <Badge value={b.ride.rideStatus} /> : '—') },
    { key: 'at', header: 'Placed', render: (b) => fmtDateTime(b.createdAt) },
  ];

  return (
    <Card>
      <CardHead
        eyebrow="Bids"
        title="Bids placed"
        action={<Tabs value={rideType} onChange={(v) => { setRideType(v); setPage(1); }} options={[{ value: 'quickride', label: 'Quick' }, { value: 'outstation', label: 'Outstation' }]} />}
      />
      {rideType === 'quickride' && (
        <InfoNote className="mx-5 mt-4">Quick-ride bids are deleted 60 seconds after they are placed unless accepted, so this mostly shows bids that won.</InfoNote>
      )}
      {error && <ErrorNote error={error} className="m-4" />}
      <div className="mt-3">
        <Table columns={columns} rows={data?.data} loading={loading} onRowClick={(b) => b.ride && navigate(`${base}/${b.ride._id}`)} empty={<EmptyState title="No bids" />} />
      </div>
      {data && data.total > 10 && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />}
    </Card>
  );
}

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'kyc', label: 'Licence & KYC' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'rides', label: 'Rides' },
  { value: 'bids', label: 'Bids' },
  { value: 'notes', label: 'Notes' },
];

export default function DriverDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const { data, error, loading, reload } = useApi(`/drivers/${id}`);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const { driver: d, onboarding, kyc, vehicle: v, payment, rating, rides, bids, activeRide, live } = data;
  const activeRideLink = activeRide && `${activeRide.rideType === 'outstation' ? '/outstation-rides' : '/quick-rides'}/${activeRide._id}`;

  return (
    <>
      <BackLink to="/drivers">Drivers</BackLink>
      <PageHead
        eyebrow="Driver"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={d.name} src={d.profileImageUrl} size="h-10 w-10" />
            {d.name || 'Unnamed driver'}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={kyc.status} />
            <LiveChip live={live} />
            {activeRide && (
              <Link to={activeRideLink} className="text-xs text-brand hover:text-brand-deep">
                On {activeRide.rideType === 'outstation' ? 'an outstation' : 'a quick'} ride {shortId(activeRide._id)} ({titleCase(activeRide.rideStatus)})
              </Link>
            )}
            <span className="text-ink/45">Joined {fmtDate(d.createdAt)}</span>
          </span>
        }
        action={
          <>
          {can('people.edit') && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit profile
            </Button>
          )}
          <BlockAction
            kind="drivers"
            id={d._id}
            blocked={d.isBlocked}
            name={d.name}
            onDone={reload}
            extraWarning={
              activeRide ? (
                <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
                  This driver has an active ride ({shortId(activeRide._id)}). Blocking does <strong>not</strong> cancel it — sort the ride out with the rider first.
                </p>
              ) : null
            }
          />
          </>
        }
      />
      <EditDriverProfile open={editing} onClose={() => setEditing(false)} driver={d} onSaved={reload} />
      {d.isBlocked && <BlockedBanner reason={d.blockedReason} at={d.blockedAt} who="driver" />}

      <div className="mb-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard eyebrow="Rating" value={rating.average != null ? rating.average.toFixed(1) : '—'} caption={`${fmtNumber(rating.count)} reviews`} />
        <StatCard eyebrow="Quick rides" value={fmtNumber(rides.quick.byStatus.completed || 0)} caption="completed">
          <StatRow label="Assigned, all time" value={fmtNumber(rides.quick.total)} />
          <StatRow label="Ride value" value={fmtMoney(rides.quick.completedValue)} />
        </StatCard>
        <StatCard eyebrow="Outstation rides" value={fmtNumber(rides.outstation.byStatus.completed || 0)} caption="completed">
          <StatRow label="Assigned, all time" value={fmtNumber(rides.outstation.total)} />
          <StatRow label="Ride value" value={fmtMoney(rides.outstation.completedValue)} />
        </StatCard>
        <StatCard eyebrow="Bids placed" value={fmtNumber(bids.quick + bids.outstation)} caption="still on record">
          <StatRow label="Quick" value={fmtNumber(bids.quick)} />
          <StatRow label="Outstation" value={fmtNumber(bids.outstation)} />
        </StatCard>
      </div>

      <Tabs value={tab} onChange={setTab} options={TABS} className="mb-5 flex-wrap" />

      {tab === 'profile' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHead
              eyebrow="Personal"
              title="Profile"
              action={
                <>
                  <AccountStatus blocked={d.isBlocked} />
                  {can('people.edit') && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Pencil size={13} /> Edit
                    </Button>
                  )}
                </>
              }
            />
            <CardBody>
              <KeyValues
                items={[
                  ['Name', d.name],
                  ['Date of birth', d.dob ? fmtDate(d.dob) : ''],
                  ['Gender', d.gender ? titleCase(d.gender) : ''],
                  ['Address', d.address],
                  ['Onboarding', onboarding.isComplete ? 'Complete' : `Step ${onboarding.completedStep} of ${onboarding.totalSteps} — next: ${titleCase(onboarding.nextStep || '')}`],
                  ['Driver ID', <span className="font-mono text-xs">{d._id}</span>],
                ]}
              />
            </CardBody>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHead eyebrow="Contact" title="Reach the driver" />
              <CardBody>
                <KeyValues items={[['Phone', d.phoneNumber], ['Email', d.email], ['Joined', fmtDateTime(d.createdAt)], ['Last updated', fmtDateTime(d.updatedAt)]]} />
              </CardBody>
            </Card>
            <Card>
              <CardHead eyebrow="Payouts" title="Payment details" action={<Wallet size={16} className="text-ink/40" />} />
              <CardBody>
                {payment ? (
                  <KeyValues items={[['UPI ID', <span className="font-mono text-sm">{payment.upiId}</span>], ['Added', fmtDate(payment.createdAt)], ['Last updated', fmtDateTime(payment.updatedAt)]]} />
                ) : (
                  <p className="text-sm text-ink/45">The driver has not added a UPI ID yet.</p>
                )}
                <p className="mt-3 text-[11px] text-ink/40">Read-only. Bharat Yaatri does not move money through this record.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'kyc' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHead
              eyebrow="Identity"
              title="KYC"
              action={
                <>
                  {kyc.status === 'pending' && kyc.method === 'manual' && can('kyc.review') && (
                    <Link to={`/kyc/${d._id}`}><Button size="sm">Review now</Button></Link>
                  )}
                  <ChangeKycStatus
                    driverId={d._id}
                    status={kyc.status}
                    missingDocuments={kyc.missingDocuments}
                    hasManualPhotos={Boolean(d.manualKyc?.aadhaarFrontImageUrl && d.manualKyc?.aadhaarBackImageUrl)}
                    onDone={reload}
                  />
                </>
              }
            />
            <CardBody className="space-y-4">
              <KeyValues
                items={[
                  ['Status', <Badge value={kyc.status} />],
                  ['Method', kyc.method ? <Badge value={kyc.method} /> : 'Not chosen'],
                  ['Aadhaar number', d.aadharCardNumber],
                  ['Name entered', d.name],
                  ['Name on Aadhaar', kyc.aadhaarName],
                  kyc.manual?.submittedAt && ['Submitted', fmtDateTime(kyc.manual.submittedAt)],
                  kyc.manual?.reviewedAt && ['Reviewed', fmtDateTime(kyc.manual.reviewedAt)],
                  kyc.failedReason && ['Rejected because', <span className="text-red-700">{kyc.failedReason}</span>],
                ]}
              />
              {kyc.aadhaarName && d.name && kyc.aadhaarName.trim().toLowerCase() !== d.name.trim().toLowerCase() && (
                <InfoNote>The name on the Aadhaar differs from the name the driver typed. Check they are the same person.</InfoNote>
              )}
              {kyc.method === 'manual' && (
                <div className="grid grid-cols-2 gap-3">
                  <DocThumb label="Aadhaar front" src={kyc.manual?.aadhaarFrontImageUrl} />
                  <DocThumb label="Aadhaar back" src={kyc.manual?.aadhaarBackImageUrl} />
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead eyebrow="Licence" title="Driving licence" />
            <CardBody className="space-y-4">
              <KeyValues items={[['DL number', d.dlDetails?.dlNumber]]} cols={1} />
              <div className="grid grid-cols-2 gap-3">
                <DocThumb label="DL front" src={d.dlDetails?.dlFrontImageUrl} />
                <DocThumb label="DL back" src={d.dlDetails?.dlBackImageUrl} />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'vehicle' &&
        (v ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHead eyebrow="Vehicle" title={v.vehicleNumber} action={<Link to={`/vehicles/${v._id}`} className="text-xs text-brand hover:text-brand-deep">Open vehicle</Link>} />
              <CardBody>
                <KeyValues
                  items={[
                    ['Type', v.vehicleTypeId?.name],
                    ['Model', v.vehicleName],
                    ['Owner', v.ownerName],
                    ['Seats', v.seatingCapacity],
                    ['Year', v.manufactureYear],
                    ['Insurance expiry', <InsuranceBadge expiry={v.insuranceExpiry} />],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHead eyebrow="Documents" title="Photos & RC" />
              <CardBody>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(v.vehicleImages?.length ? v.vehicleImages : ['']).map((src, i) => (
                    <DocThumb key={src || i} label={`Photo ${i + 1}`} src={src} />
                  ))}
                  <DocThumb label="RC front" src={v.rcDetails?.frontImageUrl} />
                  <DocThumb label="RC back" src={v.rcDetails?.backImageUrl} />
                </div>
              </CardBody>
            </Card>
          </div>
        ) : (
          <Card>
            <div className="py-14"><EmptyState title="No vehicle registered" hint="The driver has not finished the vehicle step of onboarding." /></div>
          </Card>
        ))}

      {tab === 'reviews' && <ReviewsSection driverId={d._id} rating={rating} />}

      {tab === 'rides' && (
        <Card>
          <CardHead eyebrow="History" title="Rides driven" />
          <RideHistory filterKey="driverId" id={d._id} showCustomer />
        </Card>
      )}

      {tab === 'bids' && <BidsSection driverId={d._id} />}

      {tab === 'notes' && (
        <Card className="max-w-2xl">
          <CardHead eyebrow="Internal" title="Notes" />
          <CardBody>
            <NotesPanel entity="driver" entityId={d._id} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
