import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { Admin } from '../../models/admin.model.js';
import {
  ADMIN_ROLES,
  ADMIN_TOKEN_TTL,
  ADMIN_LOGIN_MAX_FAILURES,
  ADMIN_LOGIN_WINDOW_SECONDS,
  ADMIN_MIN_PASSWORD_LENGTH,
  permissionsFor,
} from '../../constants/admin.constants.js';
import { badRequest, handle } from './helpers.js';
import { recordAudit } from '../../services/admin/audit.service.js';

export const signAdminToken = (admin) =>
  jwt.sign({ id: String(admin._id), role: 'admin', tv: admin.tokenVersion ?? 0 }, env.JWT_SECRET, {
    expiresIn: ADMIN_TOKEN_TTL,
  });

export const adminProfile = (admin) => ({
  _id: admin._id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  roleLabel: ADMIN_ROLES[admin.role]?.label ?? admin.role,
  permissions: permissionsFor(admin.role),
  lastLoginAt: admin.lastLoginAt,
});

const failKey = (email, ip) => `admin:loginfail:${email}:${ip}`;

// Redis is the throttle store. If it is unreachable the login still works — locking every admin
// out because a counter is down would be the worse failure.
const failures = async (key) => {
  try {
    return Number(await redis.get(key)) || 0;
  } catch {
    return 0;
  }
};
const bumpFailure = async (key) => {
  try {
    await redis.multi().incr(key).expire(key, ADMIN_LOGIN_WINDOW_SECONDS).exec();
  } catch {
    /* throttle unavailable */
  }
};

export const validatePassword = (password, errors, field = 'password') => {
  const value = String(password ?? '');
  if (value.length < ADMIN_MIN_PASSWORD_LENGTH) {
    errors.push({ field, message: `Use at least ${ADMIN_MIN_PASSWORD_LENGTH} characters` });
  } else if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    errors.push({ field, message: 'Use both letters and numbers' });
  }
  return value;
};

export class AdminAuthController {
  // POST /admin/auth/login  { email, password }
  login = handle('sign in', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    const errors = [];
    if (!email) errors.push({ field: 'email', message: 'Email is required' });
    if (!password) errors.push({ field: 'password', message: 'Password is required' });
    if (errors.length) return badRequest(res, errors);

    const key = failKey(email, req.ip);
    if ((await failures(key)) >= ADMIN_LOGIN_MAX_FAILURES) {
      return res.status(429).json({ message: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const admin = await Admin.findOne({ email }).select('+passwordHash');
    const ok = admin && admin.isActive && (await bcrypt.compare(password, admin.passwordHash));
    if (!ok) {
      await bumpFailure(key);
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    return res.status(200).json({ token: signAdminToken(admin), admin: adminProfile(admin) });
  });

  // GET /admin/auth/me
  me = (req, res) => res.status(200).json({ admin: adminProfile(req.admin) });

  // PATCH /admin/auth/password  { currentPassword, newPassword }
  changePassword = handle('change password', async (req, res) => {
    const errors = [];
    const current = String(req.body?.currentPassword ?? '');
    if (!current) errors.push({ field: 'currentPassword', message: 'Enter your current password' });
    const next = validatePassword(req.body?.newPassword, errors, 'newPassword');
    if (current && next && current === next) {
      errors.push({ field: 'newPassword', message: 'Choose a password different from the current one' });
    }
    if (errors.length) return badRequest(res, errors);

    const admin = await Admin.findById(req.admin._id).select('+passwordHash');
    if (!(await bcrypt.compare(current, admin.passwordHash))) {
      return badRequest(res, [{ field: 'currentPassword', message: 'Current password is incorrect' }]);
    }

    admin.passwordHash = await bcrypt.hash(next, 12);
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1; // signs out other sessions
    await admin.save();
    await recordAudit(req, { action: 'admin.password_change', entity: 'admin', entityId: admin._id });

    return res.status(200).json({ message: 'Password changed', token: signAdminToken(admin) });
  });
}
