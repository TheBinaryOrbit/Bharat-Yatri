import { useState } from 'react';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { Button, Confirm, useToast } from '../ui/index.js';

// "Mark KYC as completed" — an admin override for any driver who is not yet verified.
//
// If documents are missing, the confirm turns into "Are you sure you want to continue without
// them?", lists what is missing, and requires a reason. The server checks the same thing
// independently (409 DOCUMENTS_MISSING), so a stale page cannot skip the question.
export function CompleteKycAction({ driverId, driverName, status, missingDocuments = [], onDone, size = 'md' }) {
  const { can } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(missingDocuments);

  if (!can('kyc.review') || status === 'verified') return null;
  const hasMissing = missing.length > 0;

  const submit = async (reason) => {
    try {
      const d = await api.patch(`/kyc/${driverId}/complete`, { reason, confirmMissingDocs: hasMissing });
      toast(d.message || 'KYC marked as completed');
      onDone?.();
    } catch (e) {
      // The server found missing documents the page did not know about: ask again with the list.
      if (e.body?.code === 'DOCUMENTS_MISSING') {
        setMissing(e.body.missingDocuments || []);
        throw Object.assign(new Error('Some documents are missing — please confirm below and give a reason.'), { fieldErrors: [] });
      }
      throw e;
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={() => {
          setMissing(missingDocuments);
          setOpen(true);
        }}
      >
        <BadgeCheck size={15} className="text-brand" /> Mark KYC as completed
      </Button>
      <Confirm
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={submit}
        tone={hasMissing ? 'danger' : 'primary'}
        eyebrow={hasMissing ? 'Documents missing' : 'Complete KYC'}
        title={hasMissing ? 'Continue KYC without documents?' : `Mark ${driverName || 'this driver'} as KYC verified?`}
        confirmLabel={hasMissing ? 'Yes, complete without documents' : 'Mark as completed'}
        reason
        reasonRequired={hasMissing}
        reasonLabel={hasMissing ? 'Why is KYC being completed without these documents?' : 'Note'}
        reasonPlaceholder={hasMissing ? 'e.g. Documents checked in person at the office' : 'Optional'}
      >
        {hasMissing ? (
          <>
            <p>
              Are you sure you want to continue the KYC process without the following document{missing.length > 1 ? 's' : ''}?
            </p>
            <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
              {missing.map((m) => (
                <li key={m.key} className="flex items-center gap-2">
                  <TriangleAlert size={13} className="shrink-0" /> {m.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>All required documents are on file.</p>
        )}
        <p>
          The driver’s KYC becomes <strong>verified</strong> and they can go online straight away. They are notified, and this
          is recorded in the audit log under your name.
        </p>
      </Confirm>
    </>
  );
}
