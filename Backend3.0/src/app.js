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

// Rider test console at /test — a browser harness for the QuickRide flow, never shipped to prod.
// Mounted BEFORE helmet on purpose: the page is a single self-contained file and helmet's default
// CSP (script-src 'self') would block its inline script. Static hits end the chain here.
if (env.NODE_ENV !== 'production') {
  app.use('/test', express.static(path.join(__dirname, '../public'), { index: 'rider-test.html' }));
}

// Security & parsing middleware
// crossOriginResourcePolicy relaxed so uploaded images load from other origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

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
