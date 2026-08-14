import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { UPLOAD_DIR } from './middlewares/upload.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Every JSON response this API produces is live state — a ride list, a bid list, a driver's
// current phase. None of it is ever safe to revalidate.
//
// Express puts a weak ETag on res.json() by default, so a second identical /quick-rides/live
// came back 304 with an EMPTY body. axios treats 304 as a failure (its default validateStatus is
// 2xx only) and clients without the body in their HTTP cache read it as empty state — either way
// the driver's ride cards disappeared on refresh. Turning the ETag off is the fix; the
// Cache-Control header below is what stops an intermediary re-introducing the same problem.
//
// This does NOT affect /uploads or /test: express.static generates its own ETags through `send`,
// independent of this setting, so real static assets stay cacheable.
app.disable('etag');

const PUBLIC_DIR = path.join(__dirname, '../public');

// Everything below is mounted BEFORE helmet on purpose: these pages are self-contained files with
// inline scripts, and the tracking page also pulls Leaflet and OpenStreetMap tiles. Helmet's
// default CSP (script-src 'self', no external img/style) blocks all of it. Static hits end the
// chain here, so no API route loses helmet's protection.
//
// NOTE for whoever ships this: /track is the one PUBLIC page in this list. If it stays the
// production tracking front-end, give it a tuned CSP here rather than none at all.

// The shareable live-tracking page. The :token in the URL is the only credential, and it is read
// by the page from its own location — never templated into the HTML, so it cannot be reflected.
// Serves both products: an opaque token could belong to either, so the page tries both APIs.
// Point TRACKING_LINK_BASE_URL at `<host>/track` to use this as the real link target.
app.get('/track/:token', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'track.html')));

// Browser test consoles, never shipped to prod. Both are rider-side:
//   /test             QuickRide
//   /test/outstation  Outstation — scheduling, the plural live list, and the rider's view of the
//                     tracking window. Driving a trip past 'assigned' needs a driver client.
if (env.NODE_ENV !== 'production') {
  // Named alias, declared before the static mount because no file matches this path.
  app.get('/test/outstation', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'outstation-test.html')));

  app.use('/test', express.static(PUBLIC_DIR, { index: 'rider-test.html' }));
}

// Security & parsing middleware
// crossOriginResourcePolicy relaxed so uploaded images load from other origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/public', express.static('../../public'));

// Request logging (skip in test)
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API routes
app.use(
  '/api/v3',
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  routes
);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
