import { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // toast('Saved') · toast.error(err) — err may be an ApiError with fieldErrors.
  const push = useCallback(
    (message, { tone = 'success', fields = [] } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, message, tone, fields }]);
      setTimeout(() => dismiss(id), fields.length ? 8000 : 4200);
    },
    [dismiss]
  );

  const api = useCallback((m, o) => push(m, o), [push]);
  api.error = (err) => push(typeof err === 'string' ? err : err?.message || 'Something went wrong', { tone: 'error', fields: err?.fieldErrors || [] });

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex animate-fade-up items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-sm shadow-card ${t.tone === 'error' ? 'border-red-200' : 'border-line'}`}
          >
            {t.tone === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />}
            <div className="min-w-0 flex-1 text-ink/85">
              <p>{t.message}</p>
              {t.fields.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-ink/65">
                  {t.fields.map((f) => (
                    <li key={f.field}>
                      <span className="font-medium">{f.field}</span> — {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-ink/35 hover:text-ink" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
