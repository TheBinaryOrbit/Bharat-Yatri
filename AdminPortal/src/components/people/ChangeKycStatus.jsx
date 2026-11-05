import { useEffect, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { api, fieldMap } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { KYC_LABEL } from '../../lib/format.js';
import { Badge, Button, ErrorNote, Field, Modal, Select, Textarea, useToast } from '../ui/index.js';

const EFFECT = {
  verified: 'The driver becomes KYC verified and can go online straight away. They are notified.',
  rejected: 'The driver is told KYC was rejected and sees your reason. They can submit new documents from the app.',
  pending: 'The driver goes back into the manual KYC review queue with the Aadhaar photos already on file.',
  not_started: 'KYC is reset. The driver has to start KYC again from the app.',
};

// Set a driver's KYC to any status. Choosing "Verified" while documents are missing asks
// "are you sure you want to continue without them?" and needs a reason; the server enforces the same.
export function ChangeKycStatus({ driverId, status, missingDocuments = [], hasManualPhotos, onDone, size = 'sm' }) {
  const { can } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState('');
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(missingDocuments);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNext('');
      setReason('');
      setError(null);
      setMissing(missingDocuments);
    }
  }, [open, missingDocuments]);

  if (!can('kyc.review')) return null;
  const current = status || 'not_started';
  const options = Object.keys(KYC_LABEL)
    .filter((k) => k !== current)
    .map((k) => ({ value: k, label: KYC_LABEL[k] }));

  const withoutDocs = next === 'verified' && missing.length > 0;
  const reasonRequired = next && !(next === 'verified' && !missing.length);
  const pendingBlocked = next === 'pending' && !hasManualPhotos;

  const save = async () => {
    if (reasonRequired && !reason.trim()) {
      setError({ message: 'Please fix the highlighted fields', fieldErrors: [{ field: 'reason', message: 'A reason is required' }] });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const d = await api.patch(`/kyc/${driverId}/status`, { status: next, reason: reason.trim(), confirmMissingDocs: withoutDocs });
      toast(d.message);
      setOpen(false);
      onDone?.();
    } catch (e) {
      if (e.body?.code === 'DOCUMENTS_MISSING') {
        setMissing(e.body.missingDocuments || []);
        setError({ message: 'Some documents are missing — please confirm below and give a reason.', fieldErrors: [] });
      } else setError(e);
    } finally {
      setBusy(false);
    }
  };

  const fe = fieldMap(error);
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        <ShieldCheck size={14} className="text-brand" /> Change KYC status
      </Button>
      <Modal
        open={open}
        onClose={busy ? undefined : () => setOpen(false)}
        eyebrow="KYC"
        title={withoutDocs ? 'Continue KYC without documents?' : 'Change KYC status'}
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Keep as is</Button>
            <Button variant={withoutDocs || next === 'rejected' || next === 'not_started' ? 'danger' : 'primary'} onClick={save} loading={busy} disabled={!next || pendingBlocked}>
              {withoutDocs ? 'Yes, continue without documents' : 'Change status'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm leading-relaxed text-ink/75">
          <p className="flex items-center gap-2">
            Current status <Badge value={current} />
          </p>
          <Field label="New status" error={fe.status}>
            <Select value={next} onChange={(e) => setNext(e.target.value)} placeholder="Choose a status" options={options} error={fe.status} />
          </Field>

          {withoutDocs && (
            <div className="space-y-2">
              <p>Are you sure you want to continue the KYC process without the following document{missing.length > 1 ? 's' : ''}?</p>
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                {missing.map((m) => (
                  <li key={m.key} className="flex items-center gap-2">
                    <TriangleAlert size={13} className="shrink-0" /> {m.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pendingBlocked && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              Pending review needs both Aadhaar photos on file. Choose “Not started” instead so the driver can upload them.
            </p>
          )}
          {next && current === 'verified' && (
            <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              This driver is verified today. Changing the status takes them offline and stops them going online until KYC is verified again.
            </p>
          )}
          {next && <p>{EFFECT[next]}</p>}

          {next && (
            <Field
              label={next === 'rejected' ? 'Reason (shown to the driver)' : withoutDocs ? 'Why is KYC being completed without these documents?' : 'Reason'}
              hint={reasonRequired ? 'Required · recorded in the audit log' : 'Optional'}
              error={fe.reason}
            >
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} error={fe.reason} />
            </Field>
          )}
          {error && !error.fieldErrors?.length && <ErrorNote error={error} />}
        </div>
      </Modal>
    </>
  );
}
