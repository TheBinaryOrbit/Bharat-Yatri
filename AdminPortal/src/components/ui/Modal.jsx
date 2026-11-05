import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';
import { ErrorNote, Field, Textarea } from './Form.jsx';

export function Modal({ open, onClose, eyebrow, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative z-10 w-full ${width} animate-fade-up rounded-t-xl border border-line bg-white shadow-xl sm:rounded-xl`} role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
            <h2 className="font-display text-xl leading-tight">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-mist/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

// Confirmation for high-impact actions. `reason` adds a required reason box; onConfirm gets it.
export function Confirm({
  open, onClose, onConfirm, title, eyebrow = 'Please confirm', children, confirmLabel = 'Confirm', tone = 'danger',
  reason = false, reasonLabel = 'Reason', reasonPlaceholder = '', reasonRequired = true,
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const go = async () => {
    if (reason && reasonRequired && !text.trim()) {
      setError({ message: 'Please give a reason', fieldErrors: [] });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      eyebrow={eyebrow}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep as is
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={go} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-ink/75">
        {children}
        {reason && (
          <Field label={reasonLabel} hint={reasonRequired ? 'Required · recorded in the audit log' : 'Optional'}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={reasonPlaceholder} rows={3} autoFocus maxLength={500} />
          </Field>
        )}
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}
