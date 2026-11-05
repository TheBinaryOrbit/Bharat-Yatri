import { env } from './env.js';

// Which browser origins may call this API and open a socket.
//
// Only browsers send an Origin header, so this only limits websites. The mobile apps, curl and
// server-to-server calls send no Origin and are always let through. Their real gate is the JWT.
//
// The API's own origin (BASE_URL) is always allowed, so /track and the /test consoles keep
// working when they are served from this host.

const toOrigin = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const configured = env.CORS_ALLOWED_ORIGINS;
const allowAll = configured.length === 0 || configured.includes('*');

const exact = new Set(configured.filter((o) => !o.includes('*')).map((o) => toOrigin(o) || o));
const selfOrigin = env.BASE_URL ? toOrigin(env.BASE_URL) : null;
if (selfOrigin) exact.add(selfOrigin);

// "*.example.com" or "https://*.example.com" → that domain's subdomains, on http or https unless
// a scheme is given.
const wildcards = configured
  .filter((o) => o.includes('*') && o !== '*')
  .map((o) => {
    const m = o.match(/^(?:(https?):\/\/)?\*\.(.+)$/);
    if (!m) return null;
    const scheme = m[1] ? m[1] : 'https?';
    const host = m[2].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${scheme}://([a-z0-9-]+\\.)+${host}(:\\d+)?$`, 'i');
  })
  .filter(Boolean);

export const isOriginAllowed = (origin) => {
  if (!origin) return true; // native apps, curl, server-to-server
  if (allowAll) return true;
  if (exact.has(origin)) return true;
  return wildcards.some((rx) => rx.test(origin));
};

// For the `cors` middleware. A disallowed origin gets no CORS headers rather than an error, so the
// browser blocks it cleanly and the server log is not flooded with 500s.
export const corsOptions = {
  origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
  credentials: false,
  maxAge: 600,
};

// For Socket.IO. `cors` there only covers HTTP long-polling; a plain WebSocket upgrade skips CORS
// entirely, so allowRequest is what actually turns a bad origin away on both transports.
export const socketCorsOptions = {
  cors: { origin: (origin, callback) => callback(null, isOriginAllowed(origin)) },
  allowRequest: (req, callback) => {
    const ok = isOriginAllowed(req.headers.origin);
    callback(ok ? null : 'Origin not allowed', ok);
  },
};

export const describeCors = () => {
  if (configured.length === 0) {
    return '⚠️  CORS_ALLOWED_ORIGINS is not set, so every browser origin is allowed. Set it before going live.';
  }
  if (allowAll) return 'CORS: every origin is allowed (CORS_ALLOWED_ORIGINS=*)';
  return `CORS: allowed origins ${[...exact, ...configured.filter((o) => o.includes('*'))].join(', ')}`;
};
