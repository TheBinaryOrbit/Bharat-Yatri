import mongoose from 'mongoose';

// Append-only record of what an admin changed. There is no update or delete route for this
// collection — the portal can only read it.
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    adminName: { type: String },
    adminRole: { type: String },
    action: { type: String, required: true }, // e.g. 'driver.block', 'kyc.approve', 'vehicleType.update'
    entity: { type: String, required: true }, // collection-ish name: 'driver', 'user', 'setting', ...
    entityId: { type: String, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
