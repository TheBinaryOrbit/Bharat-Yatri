import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-3xl">Nothing lives at this address</h1>
      <p className="mt-2 text-sm text-ink/55">
        The link may be old. <Link to="/" className="text-brand hover:text-brand-deep">Back to the dashboard</Link>.
      </p>
    </div>
  );
}
