import { verifyToken } from '../utils/token.js';
import { Admin } from '../models/admin.model.js';
import { permissionsFor } from '../constants/admin.constants.js';

// Verifies an admin-portal JWT ({ id, role: 'admin', tv }) and attaches req.admin + req.permissions.
//
// User/driver tokens share the signing secret, so the role claim is what separates them; the
// tokenVersion check is what makes "sign out everywhere" (password change, deactivation) real.
export const adminProtect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Sign in to continue' });

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Sign in again.' });
  }
  if (decoded.role !== 'admin') {
    return res.status(401).json({ message: 'Not an admin session' });
  }

  try {
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive || (admin.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
      return res.status(401).json({ message: 'Your session has expired. Sign in again.' });
    }
    req.admin = admin;
    req.permissions = new Set(permissionsFor(admin.role));
    return next();
  } catch (error) {
    console.error('adminProtect error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Route-level permission gate. Several permissions = any one of them is enough.
export const can = (...perms) => (req, res, next) => {
  if (perms.some((perm) => req.permissions?.has(perm))) return next();
  return res.status(403).json({ message: 'You do not have permission to do this' });
};
