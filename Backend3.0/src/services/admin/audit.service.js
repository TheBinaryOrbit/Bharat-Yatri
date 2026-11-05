import { AuditLog } from '../../models/auditLog.model.js';

// Strips mongoose wrappers and the noisy bookkeeping fields so before/after diffs stay readable.
const plain = (value) => {
  if (value == null) return null;
  const obj = typeof value.toObject === 'function' ? value.toObject() : value;
  const copy = JSON.parse(JSON.stringify(obj));
  if (copy && typeof copy === 'object') {
    delete copy.__v;
    delete copy.passwordHash;
    delete copy.fcmToken;
  }
  return copy;
};

// Records one admin action. Never throws: a failed audit write is logged, not surfaced, so it
// cannot turn a successful change into an error the admin retries.
export const recordAudit = async (req, { action, entity, entityId = null, before = null, after = null, reason = '' }) => {
  try {
    await AuditLog.create({
      adminId: req.admin._id,
      adminName: req.admin.name,
      adminRole: req.admin.role,
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      before: plain(before),
      after: plain(after),
      reason,
      ip: req.ip || '',
    });
  } catch (error) {
    console.error('[audit] write failed:', action, error.message);
  }
};

// Keeps only the keys that changed, for a compact before/after pair.
export const diffFields = (before, after, fields) => {
  const b = {};
  const a = {};
  fields.forEach((field) => {
    const bv = before?.[field];
    const av = after?.[field];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[field] = bv ?? null;
      a[field] = av ?? null;
    }
  });
  return { before: b, after: a };
};
