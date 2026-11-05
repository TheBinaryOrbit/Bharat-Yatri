import { useParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { fmtDate, fmtDateTime, fmtNumber } from '../lib/format.js';
import { Badge, Card, CardBody, CardHead, CardLink, DocThumb, ErrorNote, InfoNote, KeyValues, NotesPanel, PageHead, Person, Spinner } from '../components/ui/index.js';
import { AccountStatus, BackLink, InsuranceBadge } from '../components/people/shared.jsx';

export default function VehicleDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi(`/vehicles/${id}`);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const { vehicle: v, completedRides } = data;
  const d = v.driverId;
  const photos = v.vehicleImages?.length ? v.vehicleImages : [''];

  return (
    <>
      <BackLink to="/vehicles">Vehicles</BackLink>
      <PageHead eyebrow="Vehicle" title={v.vehicleNumber} description={[v.vehicleTypeId?.name, v.vehicleName].filter(Boolean).join(' · ') || undefined} />
      <InfoNote icon={Info} className="mb-5">
        Read-only. The backend has no separate vehicle verification step — vehicle documents are checked as part of the driver’s onboarding and KYC.
      </InfoNote>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead eyebrow="Registration" title="Details" />
          <CardBody>
            <KeyValues
              items={[
                ['Number', v.vehicleNumber],
                ['Type', v.vehicleTypeId?.name],
                ['Model', v.vehicleName],
                ['Owner name', v.ownerName],
                ['Seats', v.seatingCapacity],
                ['Manufacture year', v.manufactureYear],
                ['Insurance expiry', <InsuranceBadge expiry={v.insuranceExpiry} />],
                ['Added', fmtDateTime(v.createdAt)],
                ['Last updated', fmtDateTime(v.updatedAt)],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHead eyebrow="Linked driver" title="Driver" action={d && <CardLink to={`/drivers/${d._id}`}>Open profile</CardLink>} />
          <CardBody className="space-y-4">
            {d ? (
              <>
                <Person name={d.name} sub={d.phoneNumber} src={d.profileImageUrl} avatar to={`/drivers/${d._id}`} />
                <KeyValues
                  cols={1}
                  items={[
                    ['KYC', <Badge value={d.kycStatus || 'not_started'} />],
                    ['Account', <AccountStatus blocked={d.isBlocked} />],
                    ['Joined', fmtDate(d.createdAt)],
                    ['Completed quick rides', fmtNumber(completedRides.quick)],
                    ['Completed outstation rides', fmtNumber(completedRides.outstation)],
                  ]}
                />
              </>
            ) : (
              <p className="text-sm text-ink/45">The driver account no longer exists.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead eyebrow="Documents" title="Photos & RC" />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photos.map((src, i) => (
                <DocThumb key={src || i} label={`Vehicle photo ${i + 1}`} src={src} />
              ))}
              <DocThumb label="RC front" src={v.rcDetails?.frontImageUrl} />
              <DocThumb label="RC back" src={v.rcDetails?.backImageUrl} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHead eyebrow="Internal" title="Notes" />
          <CardBody>
            <NotesPanel entity="vehicle" entityId={v._id} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
