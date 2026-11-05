import bcrypt from 'bcryptjs';
import { Admin } from '../../models/admin.model.js';
import { AuditLog } from '../../models/auditLog.model.js';
import { ADMIN_ROLES, ADMIN_ROLE_KEYS } from '../../constants/admin.constants.js';
import { recordAudit } from '../../services/admin/audit.service.js';
import { validatePassword } from './adminAuth.controller.js';
import { badRequest, containsRegex, dateFilter, handle, isId, listResponse, pageParams, sortParams } from './helpers.js';

const shape = (a) => ({
  _id: a._id,
  email: a.email,
  name: a.name,
  role: a.role,
  roleLabel: ADMIN_ROLES[a.role]?.label ?? a.role,
  isActive: a.isActive,
  lastLoginAt: a.lastLoginAt,
  createdAt: a.createdAt,
});

export class AdminUsersController {
  // GET /admin/admins/roles — role catalogue for the portal's role picker
  roles = (req, res) =>
    res.status(200).json({
      data: ADMIN_ROLE_KEYS.map((key) => ({ key, label: ADMIN_ROLES[key].label, permissions: ADMIN_ROLES[key].permissions })),
    });

  // GET /admin/admins
  list = handle('load admin users', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const filter = {};
    if (req.query.q) filter.$or = [{ name: containsRegex(req.query.q) }, { email: containsRegex(req.query.q) }];
    if (req.query.role && ADMIN_ROLE_KEYS.includes(req.query.role)) filter.role = req.query.role;
    const [rows, total] = await Promise.all([
      Admin.find(filter)
        .sort(sortParams(req.query, { name: 'name', role: 'role', isActive: 'isActive', lastLoginAt: 'lastLoginAt', createdAt: 'createdAt' }, { createdAt: -1 })).skip(skip).limit(limit).lean(),
      Admin.countDocuments(filter),
    ]);
    return listResponse(res, { data: rows.map(shape), total, page, limit });
  });

  // POST /admin/admins  { name, email, role, password }
  create = handle('create admin', async (req, res) => {
    const errors = [];
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const role = req.body?.role;
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'email', message: 'Enter a valid email' });
    if (!ADMIN_ROLE_KEYS.includes(role)) errors.push({ field: 'role', message: 'Choose a role' });
    const password = validatePassword(req.body?.password, errors);
    if (errors.length) return badRequest(res, errors);

    if (await Admin.exists({ email })) {
      return badRequest(res, [{ field: 'email', message: 'An admin with this email already exists' }]);
    }

    const admin = await Admin.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
    await recordAudit(req, { action: 'admin.create', entity: 'admin', entityId: admin._id, after: shape(admin) });
    return res.status(201).json(shape(admin));
  });

  // PATCH /admin/admins/:id  { name?, role?, isActive?, password? }
  update = handle('update admin', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid admin id' });

    const admin = await Admin.findById(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const before = shape(admin);

    const errors = [];
    const isSelf = String(admin._id) === String(req.admin._id);
    const body = req.body || {};
    let revoke = false;

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      else admin.name = name;
    }
    if (body.role !== undefined && body.role !== admin.role) {
      if (!ADMIN_ROLE_KEYS.includes(body.role)) errors.push({ field: 'role', message: 'Choose a role' });
      else if (isSelf) errors.push({ field: 'role', message: 'You cannot change your own role' });
      else {
        admin.role = body.role;
        revoke = true;
      }
    }
    if (body.isActive !== undefined && Boolean(body.isActive) !== admin.isActive) {
      if (isSelf) errors.push({ field: 'isActive', message: 'You cannot deactivate yourself' });
      else {
        admin.isActive = Boolean(body.isActive);
        revoke = true;
      }
    }
    if (body.password) {
      const password = validatePassword(body.password, errors);
      if (!errors.some((e) => e.field === 'password')) {
        admin.passwordHash = await bcrypt.hash(password, 12);
        revoke = true;
      }
    }
    if (errors.length) return badRequest(res, errors);

    // Never leave the portal without an active super admin.
    if (before.role === 'super_admin' && (admin.role !== 'super_admin' || !admin.isActive)) {
      const others = await Admin.countDocuments({ _id: { $ne: admin._id }, role: 'super_admin', isActive: true });
      if (!others) return res.status(409).json({ message: 'At least one active super admin must remain' });
    }

    if (revoke) admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();
    await recordAudit(req, {
      action: body.password ? 'admin.reset_password' : 'admin.update',
      entity: 'admin',
      entityId: admin._id,
      before,
      after: shape(admin),
    });
    return res.status(200).json(shape(admin));
  });

  // GET /admin/audit-logs?action&entity&entityId&adminId&from&to
  auditLogs = handle('load audit log', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const errors = [];
    const createdAt = dateFilter(req.query, errors);
    if (errors.length) return badRequest(res, errors);

    const filter = {};
    if (createdAt) filter.createdAt = createdAt;
    if (req.query.action) filter.action = containsRegex(req.query.action);
    if (req.query.entity) filter.entity = String(req.query.entity);
    if (req.query.entityId) filter.entityId = String(req.query.entityId);
    if (req.query.adminId && isId(req.query.adminId)) filter.adminId = req.query.adminId;

    const [rows, total] = await Promise.all([
      AuditLog.find(filter)
        .sort(sortParams(req.query, { createdAt: 'createdAt', admin: 'adminName', action: 'action', entity: 'entity' }, { createdAt: -1 })).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return listResponse(res, { data: rows, total, page, limit });
  });
}
