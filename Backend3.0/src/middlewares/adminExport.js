import { recordAudit } from '../services/admin/audit.service.js';

const NOT_FILTERS = new Set(['export', 'page', 'limit', 'skip', 'format']);

// ?export=1 on any admin GET list marks a request as part of an Excel export from the portal.
// Exports need reports.export (the button is hidden without it, but this is the control), may
// page in bigger chunks (see pageParams), and are written to the audit log once — on the first
// page — with the filters used, since an export carries people's details out of the portal.
export const exportGate = async (req, res, next) => {
  if (req.method !== 'GET' || req.query.export !== '1') return next();
  if (!req.permissions?.has('reports.export')) {
    return res.status(403).json({ message: 'You do not have permission to export data' });
  }
  const firstPage = (!req.query.page || req.query.page === '1') && (!req.query.skip || req.query.skip === '0');
  if (firstPage) {
    const filters = Object.fromEntries(Object.entries(req.query).filter(([k]) => !NOT_FILTERS.has(k)));
    await recordAudit(req, { action: 'data.export', entity: 'export', entityId: req.path, after: { list: req.path, filters } });
  }
  return next();
};
