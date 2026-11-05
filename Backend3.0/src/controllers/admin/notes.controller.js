import { AdminNote } from '../../models/adminNote.model.js';
import { NOTE_ENTITIES } from '../../constants/admin.constants.js';
import { recordAudit } from '../../services/admin/audit.service.js';
import { badRequest, handle, isId } from './helpers.js';

export class NotesController {
  // GET /admin/notes?entity&entityId
  list = handle('load notes', async (req, res) => {
    const { entity, entityId } = req.query;
    if (!NOTE_ENTITIES.includes(entity) || !isId(entityId)) return res.status(400).json({ message: 'entity and entityId are required' });
    const notes = await AdminNote.find({ entity, entityId }).populate('adminId', 'name role').sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json({ data: notes });
  });

  // POST /admin/notes  { entity, entityId, body }
  create = handle('save note', async (req, res) => {
    const { entity, entityId } = req.body || {};
    const body = String(req.body?.body ?? '').trim();
    const errors = [];
    if (!NOTE_ENTITIES.includes(entity) || !isId(entityId)) errors.push({ field: 'entity', message: 'Unknown record' });
    if (!body) errors.push({ field: 'body', message: 'Write something first' });
    if (body.length > 2000) errors.push({ field: 'body', message: 'Keep notes under 2000 characters' });
    if (errors.length) return badRequest(res, errors);

    const note = await AdminNote.create({ entity, entityId, body, adminId: req.admin._id });
    await recordAudit(req, { action: 'note.add', entity, entityId, after: { body } });
    const populated = await note.populate('adminId', 'name role');
    return res.status(201).json(populated);
  });
}
