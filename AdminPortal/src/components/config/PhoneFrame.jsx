// A phone-width frame for previewing what the apps will render.
export function PhoneFrame({ title, children }) {
  return (
    <div className="mx-auto w-[320px] rounded-[2rem] border-[6px] border-navy bg-white shadow-card">
      <div className="flex items-center justify-center gap-2 border-b border-line bg-navy py-2.5 text-xs font-medium text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        {title || 'Bharat Yaatri'}
      </div>
      <div className="h-[520px] overflow-y-auto rounded-b-[1.6rem] px-4 py-4">{children}</div>
    </div>
  );
}
