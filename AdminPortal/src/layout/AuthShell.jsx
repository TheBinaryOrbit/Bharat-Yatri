import { Wordmark } from './Sidebar.jsx';

// Split auth layout. Left panel is the logo's navy, with the theme's concentric-circle motif
// redrawn in orange and white, plus a road line borrowed from the mark.
export function AuthShell({ title, description, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <Wordmark size="text-3xl" tracking="tracking-[0.18em]" />
        <div className="relative z-10 max-w-md">
          <p className="text-eyebrow font-medium uppercase text-brand">Admin</p>
          <p className="mt-3 font-display text-4xl leading-[1.15] text-white">
            Every ride, every driver, every rupee of the journey — in one calm place.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/45">For Bharat Yaatri operations staff only. Activity is logged.</p>
        <svg className="pointer-events-none absolute -right-40 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2" viewBox="0 0 480 480" aria-hidden="true">
          <circle cx="240" cy="240" r="230" fill="#F26B21" opacity="0.9" />
          <circle cx="240" cy="240" r="182" fill="#163B61" />
          <circle cx="240" cy="240" r="134" fill="none" stroke="#F8B88E" strokeWidth="0.8" strokeDasharray="2 7" />
          <path d="M150 330 C 200 290, 230 250, 250 170" fill="none" stroke="#FFFFFF" strokeWidth="26" strokeLinecap="round" opacity="0.92" />
          <path d="M150 330 C 200 290, 230 250, 250 170" fill="none" stroke="#163B61" strokeWidth="2.5" strokeDasharray="10 12" strokeLinecap="round" />
        </svg>
      </aside>
      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark size="text-2xl" tracking="tracking-[0.16em]" light={false} />
          </div>
          <h1 className="font-display text-3xl leading-tight">{title}</h1>
          {description && <p className="mt-2 text-sm text-ink/55">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
