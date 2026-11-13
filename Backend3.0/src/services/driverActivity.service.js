import { DriverActivity } from '../models/driverActivity.model.js';
import { DRIVER_ACTIVITY, UPLOAD_LABELS } from '../constants/driverActivity.constants.js';
import { buildFileUrl } from '../utils/fileUrl.js';

// The files multer accepted on this request, as { field, label, url } — the same URLs the
// controllers store on the driver / vehicle.
export const uploadsFrom = (req) => {
  const files = req.files || {};
  const list = Array.isArray(files) ? files : Object.values(files).flat();
  const counts = {};
  return list.map((f) => {
    counts[f.fieldname] = (counts[f.fieldname] || 0) + 1;
    const many = (files[f.fieldname]?.length || 0) > 1;
    const base = UPLOAD_LABELS[f.fieldname] || f.fieldname;
    return { field: f.fieldname, label: many ? `${base} ${counts[f.fieldname]}` : base, url: buildFileUrl(req, f.filename) };
  });
};

// Which of `names` were sent in the body (non-empty).
export const fieldsSent = (body, names) =>
  names.filter((n) => body?.[n] !== undefined && body?.[n] !== null && String(body[n]).trim() !== '');

const actorOf = (req, driverId) => {
  if (req?.admin) return { kind: 'admin', id: req.admin._id, name: req.admin.name || '' };
  if (req?.user && String(req.user._id) === String(driverId)) return { kind: 'driver', id: req.user._id, name: req.user.name || '' };
  return { kind: 'system', id: null, name: '' };
};

// Records one entry on a driver's timeline. Fire-and-forget: never throws and is not awaited by
// callers, so a failed log write cannot fail (or slow) the driver's request.
export const logDriverActivity = (req, driverId, type, { uploads = [], fields = [], meta = null, actor } = {}) => {
  if (!driverId || !DRIVER_ACTIVITY[type]) {
    console.error('[driverActivity] skipped, bad input:', type, driverId);
    return;
  }
  DriverActivity.create({
    driverId,
    type,
    category: type.split('.')[0],
    title: DRIVER_ACTIVITY[type],
    uploads,
    fields,
    meta,
    actor: actor || actorOf(req, driverId),
    ip: req?.ip || '',
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 300),
  }).catch((error) => console.error('[driverActivity] write failed:', type, error.message));
};
