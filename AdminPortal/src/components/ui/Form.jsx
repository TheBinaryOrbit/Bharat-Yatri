import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export function Label({ htmlFor, children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink/80">
        {children}
      </label>
      {hint && <span className="text-[11px] text-ink/40">{hint}</span>}
    </div>
  );
}

export function FieldError({ children }) {
  return children ? <p className="mt-1 text-[11px] text-red-600">{children}</p> : null;
}

// Label + control + error in one. Pass the control as children.
export function Field({ label, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

const invalid = (error) => (error ? 'border-red-300' : '');

export const Input = forwardRef(function Input({ error, className = '', ...rest }, ref) {
  return <input ref={ref} className={`field ${invalid(error)} ${className}`} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ error, className = '', rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={`field resize-y ${invalid(error)} ${className}`} {...rest} />;
});

export function Select({ error, className = '', placeholder, options = [], children, ...rest }) {
  return (
    <select className={`field ${invalid(error)} ${className}`} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled, id }) {
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-2.5 ${disabled ? 'opacity-55' : 'cursor-pointer'}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${checked ? 'border-brand bg-brand' : 'border-line bg-mist'}`}
      >
        <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[1.15rem]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-sm text-ink/80">{label}</span>}
    </label>
  );
}

// Never a bare "Validation failed": the server's field errors are listed underneath.
export function ErrorNote({ error, className = '' }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const fields = typeof error === 'string' ? [] : error.fieldErrors || [];
  return (
    <div className={`rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 ${className}`} role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {fields.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-red-200/70 pl-[1.4rem] pt-1.5 text-[12px]">
          {fields.map((f) => (
            <li key={f.field + f.message}>
              <span className="font-medium">{f.field}</span> — {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InfoNote({ children, className = '', icon: Icon }) {
  return (
    <div className={`flex items-start gap-2 rounded-md border border-line bg-mist px-3 py-2.5 text-[13px] text-ink/70 ${className}`}>
      {Icon && <Icon size={14} className="mt-0.5 shrink-0 text-brand" />}
      <div>{children}</div>
    </div>
  );
}
