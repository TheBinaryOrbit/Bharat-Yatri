import sanitizeHtml from 'sanitize-html';
import { AppContent } from '../../models/appContent.model.js';
import { Setting } from '../../models/setting.model.js';
import { SETTING_TYPES, SETTING_URL_FIELDS } from '../../constants/setting.constants.js';
import { validate as validateSettings, pickWritable } from '../setting.controller.js';
import { recordAudit, diffFields } from '../../services/admin/audit.service.js';
import { buildFileUrl } from '../../utils/fileUrl.js';
import { badRequest, handle, isId } from './helpers.js';

// HTML the apps render in a webview. Scripts, event handlers, iframes and javascript: URLs are
// stripped; ordinary rich-text markup and images survive.
export const cleanHtml = (html) =>
  sanitizeHtml(String(html ?? ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2', 'h3', 'h4', 'span', 'u', 's'],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['style', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/],
        'font-weight': [/^\d+$|^bold$/],
      },
    },
  });

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const CONTENT_FIELDS = ['slug', 'name', 'iconName', 'type', 'content', 'isActive'];

const readContent = (body, errors, { requireAll }) => {
  const out = {};
  if (body.slug !== undefined || requireAll) {
    const slug = String(body.slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push({ field: 'slug', message: 'Use lowercase words joined by hyphens, e.g. privacy-policy' });
    else out.slug = slug;
  }
  if (body.name !== undefined || requireAll) {
    const name = String(body.name ?? '').trim();
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    else out.name = name;
  }
  if (body.type !== undefined || requireAll) {
    if (!['user', 'driver'].includes(body.type)) errors.push({ field: 'type', message: 'Choose the rider app or the driver app' });
    else out.type = body.type;
  }
  if (body.iconName !== undefined) out.iconName = String(body.iconName).trim();
  if (body.content !== undefined || requireAll) {
    const content = cleanHtml(body.content);
    if (!content.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(content)) errors.push({ field: 'content', message: 'Content cannot be empty' });
    else out.content = content;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
};

const readSettingsExtras = (body, errors) => {
  SETTING_URL_FIELDS.forEach((field) => {
    const v = body[field];
    if (typeof v === 'string' && v.trim() && !isHttpUrl(v.trim())) errors.push({ field, message: 'Enter a full http(s) URL' });
  });
  if (Array.isArray(body.userPromotionalBanners)) {
    body.userPromotionalBanners.forEach((b, i) => {
      if (b?.imageUrl && !isHttpUrl(String(b.imageUrl).trim())) {
        errors.push({ field: `userPromotionalBanners[${i}].imageUrl`, message: 'Image must be an http(s) URL' });
      }
      if (b?.linkUrl && /^\s*(javascript|data|vbscript):/i.test(b.linkUrl)) {
        errors.push({ field: `userPromotionalBanners[${i}].linkUrl`, message: 'This link type is not allowed' });
      }
    });
  }
};

const SETTING_AUDIT_FIELDS = [
  'appVersion', 'appBuildNumber', 'isUpdateMandatory', ...SETTING_URL_FIELDS, 'supportPhoneNumber', 'homePageContent', 'userPromotionalBanners',
];

export class ContentController {
  // GET /admin/app-content?type=user|driver — every page, inactive included, without the HTML body
  listContent = handle('load app content', async (req, res) => {
    const filter = ['user', 'driver'].includes(req.query.type) ? { type: req.query.type } : {};
    const rows = await AppContent.find(filter).select('-content').sort({ type: 1, name: 1 }).lean();
    return res.status(200).json({ data: rows });
  });

  getContent = handle('load page', async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid page id' });
    const page = await AppContent.findById(req.params.id).lean();
    if (!page) return res.status(404).json({ message: 'Page not found' });
    return res.status(200).json(page);
  });

  createContent = handle('create page', async (req, res) => {
    const errors = [];
    const data = readContent(req.body || {}, errors, { requireAll: true });
    if (errors.length) return badRequest(res, errors);
    if (await AppContent.exists({ slug: data.slug, type: data.type })) {
      return badRequest(res, [{ field: 'slug', message: 'A page with this slug already exists for this app' }]);
    }
    const page = await AppContent.create(data);
    await recordAudit(req, { action: 'content.create', entity: 'appContent', entityId: page._id, after: { ...page.toObject(), content: '[html]' } });
    return res.status(201).json(page);
  });

  updateContent = handle('save page', async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid page id' });
    const existing = await AppContent.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Page not found' });

    const errors = [];
    const data = readContent(req.body || {}, errors, { requireAll: false });
    if (errors.length) return badRequest(res, errors);
    const slug = data.slug ?? existing.slug;
    const type = data.type ?? existing.type;
    if ((slug !== existing.slug || type !== existing.type) && (await AppContent.exists({ slug, type, _id: { $ne: existing._id } }))) {
      return badRequest(res, [{ field: 'slug', message: 'A page with this slug already exists for this app' }]);
    }

    const page = await AppContent.findByIdAndUpdate(existing._id, data, { new: true, runValidators: true }).lean();
    const diff = diffFields(existing, page, CONTENT_FIELDS);
    if ('content' in diff.after) {
      diff.before.content = `[html, ${existing.content.length} chars]`;
      diff.after.content = `[html, ${page.content.length} chars]`;
    }
    await recordAudit(req, { action: 'content.update', entity: 'appContent', entityId: page._id, ...diff });
    return res.status(200).json(page);
  });

  deleteContent = handle('delete page', async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid page id' });
    const page = await AppContent.findByIdAndDelete(req.params.id).lean();
    if (!page) return res.status(404).json({ message: 'Page not found' });
    await recordAudit(req, { action: 'content.delete', entity: 'appContent', entityId: page._id, before: page });
    return res.status(200).json({ message: 'Page deleted' });
  });

  // GET /admin/settings — both platforms, banners unfiltered (inactive ones included)
  listSettings = handle('load settings', async (req, res) => {
    const rows = await Setting.find().sort({ type: 1 }).lean();
    return res.status(200).json({ data: rows, platforms: SETTING_TYPES });
  });

  // PATCH /admin/settings/:type — creates the record on first save if the platform has none yet
  updateSettings = handle('save settings', async (req, res) => {
    const type = String(req.params.type).toLowerCase();
    if (!SETTING_TYPES.includes(type)) return res.status(400).json({ message: `Platform must be one of: ${SETTING_TYPES.join(', ')}` });

    const body = { ...(req.body || {}) };
    delete body.type;
    const existing = await Setting.findOne({ type }).lean();
    const errors = validateSettings(existing ? body : { ...body, type }, { requireAll: !existing });
    readSettingsExtras(body, errors);
    if (errors.length) return badRequest(res, errors);

    const update = pickWritable(body);
    if (update.homePageContent !== undefined) update.homePageContent = cleanHtml(update.homePageContent);
    if (update.userPromotionalBanners) {
      update.userPromotionalBanners = update.userPromotionalBanners.map((b, i) => ({
        ...(isId(b._id) && { _id: b._id }),
        title: String(b.title ?? '').trim(),
        imageUrl: String(b.imageUrl).trim(),
        linkUrl: String(b.linkUrl ?? '').trim(),
        order: Number.isFinite(Number(b.order)) ? Number(b.order) : i,
        isActive: b.isActive !== false,
      }));
    }
    if (!Object.keys(update).length) return res.status(400).json({ message: 'Nothing to change' });

    const saved = existing
      ? await Setting.findOneAndUpdate({ type }, update, { new: true, runValidators: true }).lean()
      : (await Setting.create({ type, ...update })).toObject();

    const diff = diffFields(existing || {}, saved, SETTING_AUDIT_FIELDS);
    await recordAudit(req, {
      action: diff.after.isUpdateMandatory === true ? 'settings.mandatory_update_on' : 'settings.update',
      entity: 'setting',
      entityId: type,
      ...diff,
    });
    return res.status(200).json(saved);
  });

  // POST /admin/uploads/image  (multipart `image`) → { url } for banners and editor images
  uploadImage = (req, res) => {
    if (!req.file) return badRequest(res, [{ field: 'image', message: 'Choose an image to upload' }]);
    return res.status(201).json({ url: buildFileUrl(req, req.file.filename) });
  };
}
