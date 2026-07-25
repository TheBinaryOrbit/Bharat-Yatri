import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { UPLOAD_DIR } from './middlewares/upload.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

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
app.use('/api/v3', routes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
