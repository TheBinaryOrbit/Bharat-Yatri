import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Info, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { fmtAgo, fmtDate, fmtDateTime, titleCase } from '../lib/format.js';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, Confirm, DocThumb, ErrorNote, Field, InfoNote, KeyValues, Modal, PageHead, Spinner, Textarea, useToast,
} from '../components/ui/index.js';
import { BackLink, BlockedBanner } from '../components/people/shared.jsx';
import { CompleteKycAction } from '../components/people/CompleteKycAction.jsx';

const PRESETS = ['Photo is blurry', 'Name does not match', 'Document not readable', 'Wrong document', 'Front and back are the same side', 'Document looks edited'];

function RejectModal({ open, onClose, onReject }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const go = async () => {
    if (!reason.trim()) {
      setError({ message: 'Tell the driver what to fix', fieldErrors: [] });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReject(reason.trim());
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      eyebrow="KYC decision"
      title="Reject this KYC"
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep as is</Button>
          <Button variant="danger" onClick={go} loading={busy}>Reject KYC</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink/75">
        <p>The driver is told the reason in the app and can upload new photos.</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${reason === p ? 'border-brand bg-brand-soft/25 text-brand-deep' : 'border-line text-ink/65 hover:border-brand hover:text-brand'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <Field label="Reason shown to the driver" hint="Required · audited">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

export default function KycReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/kyc/${id}`);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [conflict, setConflict] = useState(null);

  const decide = async (decision, reason = '') => {
    try {
      const d = await api.patch(`/kyc/${id}/review`, { decision, reason });
      toast(d.message);
      navigate('/kyc');
    } catch (e) {
      if (e.status === 409) {
        setConflict(e.message);
        setApproving(false);
        setRejecting(false);
        reload();
        return;
      }
      throw e;
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const { case: c, kyc, onboarding, vehicle } = data;
  const reviewable = c.kycStatus === 'pending' && c.kycMethod === 'manual';
  const nameMismatch = c.aadhaarName && c.name && c.aadhaarName.trim().toLowerCase() !== c.name.trim().toLowerCase();

  return (
    <>
      <BackLink to="/kyc">KYC review</BackLink>
      <PageHead
        eyebrow="KYC review"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} src={c.profileImageUrl} size="h-10 w-10" />
            {c.name || 'Unnamed driver'}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={c.kycStatus} />
            {c.kycMethod && <Badge value={c.kycMethod} />}
            {c.manualKyc?.submittedAt && <span>Submitted {fmtDateTime(c.manualKyc.submittedAt)} ({fmtAgo(c.manualKyc.submittedAt)})</span>}
            <Link to={`/drivers/${c._id}`} className="text-brand hover:text-brand-deep">Open driver profile</Link>
          </span>
        }
        action={
          reviewable ? (
            <>
              <Button variant="danger" onClick={() => setRejecting(true)}>
                <X size={15} /> Reject
              </Button>
              <Button onClick={() => setApproving(true)}>
                <Check size={15} /> Approve
              </Button>
            </>
          ) : (
            <CompleteKycAction
              driverId={c._id}
              driverName={c.name}
              status={c.kycStatus}
              missingDocuments={data.missingDocuments}
              onDone={() => navigate('/kyc')}
            />
          )
        }
      />

      {c.isBlocked && <BlockedBanner who="driver" />}
      {conflict && <ErrorNote error={conflict} className="mb-5" />}
      {!reviewable && (
        <InfoNote icon={Info} className="mb-5">
          {c.kycStatus === 'verified'
            ? 'This driver is already verified — nothing to review.'
            : c.kycStatus === 'rejected'
              ? `Rejected${c.kycFailedReason ? `: “${c.kycFailedReason}”` : ''}. The driver can submit new photos from the app, which puts them back in the queue.`
              : c.kycMethod === 'digilocker'
                ? 'This driver used DigiLocker, which is verified automatically — there is nothing to approve by hand.'
                : 'This driver has not submitted KYC documents yet.'}
        </InfoNote>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Card>
            <CardHead eyebrow="What the driver entered" title="Details" />
            <CardBody className="space-y-3">
              <KeyValues
                cols={1}
                items={[
                  ['Name', c.name],
                  c.aadhaarName && ['Name on Aadhaar (DigiLocker)', <span className={nameMismatch ? 'text-red-700' : ''}>{c.aadhaarName}</span>],
                  ['Date of birth', c.dob ? fmtDate(c.dob) : ''],
                  ['Gender', c.gender ? titleCase(c.gender) : ''],
                  ['Address', c.address],
                  ['Aadhaar number', c.aadharCardNumber],
                  ['Phone', c.phoneNumber],
                  ['DL number', c.dlDetails?.dlNumber],
                  ['Onboarding', onboarding.isComplete ? 'Complete' : `${onboarding.completedStep}/${onboarding.totalSteps}`],
                ]}
              />
              {nameMismatch && <InfoNote>The Aadhaar name and the typed name differ.</InfoNote>}
            </CardBody>
          </Card>
          <Card>
            <CardHead eyebrow="Vehicle" title={vehicle?.vehicleNumber || 'No vehicle yet'} />
            <CardBody>
              {vehicle ? (
                <KeyValues cols={1} items={[['Type', vehicle.vehicleTypeId?.name], ['Model', vehicle.vehicleName], ['Owner name', vehicle.ownerName], ['Year', vehicle.manufactureYear]]} />
              ) : (
                <p className="text-sm text-ink/45">The driver has not added a vehicle.</p>
              )}
            </CardBody>
          </Card>
          <InfoNote icon={Info}>
            Approving sets KYC to <strong>verified</strong> and lets the driver go online. Rejecting sends the reason to the driver, who can resubmit from the app.
            Both decisions are notified to the driver and recorded in the audit log.
          </InfoNote>
        </div>

        <Card>
          <CardHead eyebrow="Documents" title="Check each one" />
          <CardBody>
            <div className="grid grid-cols-2 gap-4">
              <DocThumb label="Aadhaar front" src={c.manualKyc?.aadhaarFrontImageUrl} />
              <DocThumb label="Aadhaar back" src={c.manualKyc?.aadhaarBackImageUrl} />
              <DocThumb label="Driving licence front" src={c.dlDetails?.dlFrontImageUrl} />
              <DocThumb label="Driving licence back" src={c.dlDetails?.dlBackImageUrl} />
              <DocThumb label="Profile photo" src={c.profileImageUrl} />
            </div>
            <p className="mt-4 text-[11px] text-ink/40">Click a document to zoom or rotate it. Status: {kyc.status}.</p>
          </CardBody>
        </Card>
      </div>

      <Confirm
        open={approving}
        onClose={() => setApproving(false)}
        tone="primary"
        eyebrow="KYC decision"
        title={`Approve ${c.name || 'this driver'}?`}
        confirmLabel="Approve KYC"
        onConfirm={() => decide('approve')}
      >
        <p>You have checked the Aadhaar photos match the details entered. The driver becomes verified and can go online.</p>
      </Confirm>
      <RejectModal open={rejecting} onClose={() => setRejecting(false)} onReject={(reason) => decide('reject', reason)} />
    </>
  );
}
