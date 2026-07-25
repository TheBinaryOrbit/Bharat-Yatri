import { AppContentService } from '../services/appContent.service.js';

const APP_TYPES = ['user', 'driver'];

export class AppContentController {
  constructor() {
    this.appContentService = new AppContentService();
  }

  // GET /api/v3/app-content/:type  → list all content for an app (user|driver)
  getByApp = async (req, res) => {
    const { type } = req.params;
    if (!APP_TYPES.includes(type)) {
      return res.status(400).json({ message: "App type must be 'user' or 'driver'" });
    }

    try {
      const items = await this.appContentService.getAllByType(type);
      return res.status(200).json({ count: items.length, data: items });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch app content', message: 'Internal server error' });
    }
  };

  // GET /api/v3/app-content/:type/:idOrSlug  → full details (type mandatory)
  getOne = async (req, res) => {
    const { type, idOrSlug } = req.params;
    if (!APP_TYPES.includes(type)) {
      return res.status(400).json({ message: "App type must be 'user' or 'driver'" });
    }

    try {
      const item = await this.appContentService.getByIdOrSlug(idOrSlug, type);
      if (!item) {
        return res.status(404).json({ message: 'App content not found' });
      }
      return res.status(200).json(item);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch app content', message: 'Internal server error' });
    }
  };

  // POST /api/v3/app-content  (admin only)
  create = async (req, res) => {
    const { slug, name, iconName, type, content } = req.body;

    const errors = [];
    if (!slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (!type) errors.push({ field: 'type', message: 'Type is required' });
    if (!content) errors.push({ field: 'content', message: 'Content is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    if (!APP_TYPES.includes(type)) {
      return res.status(400).json({
        message: 'Type is invalid',
        errors: [{ field: 'type', message: "Type must be 'user' or 'driver'" }],
      });
    }

    try {
      const item = await this.appContentService.create({ slug, name, iconName, type, content });
      return res.status(201).json(item);
    } catch (error) {
      console.log(error);
      if (error.code === 11000) {
        return res.status(409).json({
          message: `Content with slug '${slug}' already exists for ${type}`,
          errors: [{ field: 'slug', message: 'Slug already exists for this app type' }],
        });
      }
      return res.status(500).json({ error: 'Failed to create app content', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/app-content/:id  (admin only)
  update = async (req, res) => {
    try {
      const item = await this.appContentService.update(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: 'App content not found' });
      }
      return res.status(200).json(item);
    } catch (error) {
      console.log(error);
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Slug already exists for this app type' });
      }
      return res.status(500).json({ error: 'Failed to update app content', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/app-content/:id  (admin only)
  remove = async (req, res) => {
    try {
      const item = await this.appContentService.remove(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'App content not found' });
      }
      return res.status(200).json({ message: 'App content deleted' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to delete app content', message: 'Internal server error' });
    }
  };
}
