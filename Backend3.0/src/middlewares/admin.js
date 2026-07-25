import { env } from '../config/env.js';

// Simple admin gate: requires the x-admin-key header to match ADMIN_API_KEY.
// Placeholder until a full admin-account / JWT flow is built.
export const adminAuth = (req, res, next) => {
  if (!env.ADMIN_API_KEY) {
    return res.status(500).json({ error: 'Admin access is not configured' });
  }

  const key = req.headers['x-admin-key'];
  if (!key || key !== env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: admin access only' });
  }

  next();
};
