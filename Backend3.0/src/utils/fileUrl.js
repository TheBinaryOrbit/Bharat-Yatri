import { env } from '../config/env.js';

// Builds a public URL for an uploaded file from its stored filename.
// Uses BASE_URL if set, otherwise derives host from the request.
export const buildFileUrl = (req, filename) => {
  if (!filename) return '';
  const base = env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
};
