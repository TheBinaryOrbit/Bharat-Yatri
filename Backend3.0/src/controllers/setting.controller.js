import { SettingService } from '../services/setting.service.js';
import { isDuplicateKeyError } from '../utils/duplicateKey.js';
import { SETTING_TYPES, APP_VERSION_PATTERN, MIN_BUILD_NUMBER } from '../constants/setting.constants.js';

// What the apps see. Parked banners are filtered out and the rest are ordered here rather than in
// the app, so two platforms cannot drift on how they sort. The admin list read returns the raw
// documents instead — an editor has to see the banner it is about to un-park.
const shape = (setting) => ({
  _id: setting._id,
  type: setting.type,
  appVersion: setting.appVersion,
  appBuildNumber: setting.appBuildNumber,
  isUpdateMandatory: setting.isUpdateMandatory,
  onboardingLink: setting.onboardingLink,
  homePageContent: setting.homePageContent,
  userPromotionalBanners: (setting.userPromotionalBanners || [])
    .filter((banner) => banner.isActive)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  updatedAt: setting.updatedAt,
});

// Shared by create and update. Only the fields present are checked, so a PATCH that touches one
// field is not forced to resend the rest.
const validate = (body, { requireAll }) => {
  const errors = [];
  const has = (field) => body[field] !== undefined && body[field] !== null && body[field] !== '';

  if (requireAll && !has('type')) errors.push({ field: 'type', message: 'Type is required' });
  if (has('type') && !SETTING_TYPES.includes(String(body.type).toLowerCase())) {
    errors.push({ field: 'type', message: `Type must be one of: ${SETTING_TYPES.join(', ')}` });
  }

  if (requireAll && !has('appVersion')) {
    errors.push({ field: 'appVersion', message: 'App version is required' });
  }
  if (has('appVersion') && !APP_VERSION_PATTERN.test(String(body.appVersion).trim())) {
    errors.push({ field: 'appVersion', message: 'App version must look like 1, 1.2 or 1.2.3' });
  }

  if (requireAll && !has('appBuildNumber')) {
    errors.push({ field: 'appBuildNumber', message: 'App build number is required' });
  }
  if (has('appBuildNumber')) {
    const build = Number(body.appBuildNumber);
    if (!Number.isInteger(build) || build < MIN_BUILD_NUMBER) {
      errors.push({
        field: 'appBuildNumber',
        message: `App build number must be a whole number of at least ${MIN_BUILD_NUMBER}`,
      });
    }
  }

  if (body.isUpdateMandatory !== undefined && typeof body.isUpdateMandatory !== 'boolean') {
    errors.push({ field: 'isUpdateMandatory', message: 'isUpdateMandatory must be true or false' });
  }

  // The array is replaced wholesale, never merged — a PATCH carrying three banners leaves exactly
  // those three. Anything else makes deleting the middle banner impossible to express.
  if (body.userPromotionalBanners !== undefined) {
    if (!Array.isArray(body.userPromotionalBanners)) {
      errors.push({ field: 'userPromotionalBanners', message: 'userPromotionalBanners must be an array' });
    } else {
      body.userPromotionalBanners.forEach((banner, index) => {
        if (!banner?.imageUrl || !String(banner.imageUrl).trim()) {
          errors.push({
            field: `userPromotionalBanners[${index}].imageUrl`,
            message: 'Banner image URL is required',
          });
        }
      });
    }
  }

  return errors;
};

// Only these ever reach the document. `type` is excluded on update: it is the key the row is
// found by, and letting a PATCH rewrite it turns "edit android" into "make a second ios".
const pickWritable = (body) => {
  const fields = ['appVersion', 'appBuildNumber', 'isUpdateMandatory', 'onboardingLink', 'homePageContent', 'userPromotionalBanners'];
  const update = {};

  fields.forEach((field) => {
    if (body[field] !== undefined) update[field] = body[field];
  });

  return update;
};

export class SettingController {
  constructor() {
    this.settingService = new SettingService();
  }

  // GET /api/v3/settings  (admin only) → both platforms, raw, including parked banners
  getAll = async (req, res) => {
    try {
      const settings = await this.settingService.getAll();
      return res.status(200).json({ count: settings.length, data: settings });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch settings', message: 'Internal server error' });
    }
  };

  // GET /api/v3/settings/:type  (public) → the app's boot read for android | ios
  getByType = async (req, res) => {
    const { type } = req.params;

    if (!SETTING_TYPES.includes(String(type).toLowerCase())) {
      return res.status(400).json({ message: `Type must be one of: ${SETTING_TYPES.join(', ')}` });
    }

    try {
      const setting = await this.settingService.getByType(type);
      if (!setting) {
        return res.status(404).json({ message: `No settings found for ${type}` });
      }
      return res.status(200).json(shape(setting));
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch settings', message: 'Internal server error' });
    }
  };

  // POST /api/v3/settings  (admin only)
  create = async (req, res) => {
    const errors = validate(req.body, { requireAll: true });
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid settings', errors });
    }

    try {
      const setting = await this.settingService.create({
        type: String(req.body.type).toLowerCase(),
        ...pickWritable(req.body),
      });
      return res.status(201).json(setting);
    } catch (error) {
      console.log(error);
      if (isDuplicateKeyError(error)) {
        // One document per platform is the whole point of the collection — the fix is a PATCH.
        return res.status(409).json({
          message: `Settings for ${req.body.type} already exist. Update them instead.`,
          errors: [{ field: 'type', message: 'Settings already exist for this type' }],
        });
      }
      return res.status(500).json({ error: 'Failed to create settings', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/settings/:type  (admin only)
  update = async (req, res) => {
    const { type } = req.params;

    if (!SETTING_TYPES.includes(String(type).toLowerCase())) {
      return res.status(400).json({ message: `Type must be one of: ${SETTING_TYPES.join(', ')}` });
    }

    const errors = validate(req.body, { requireAll: false });
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid settings', errors });
    }

    const update = pickWritable(req.body);
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'No updatable fields were provided' });
    }

    try {
      const setting = await this.settingService.updateByType(type, update);
      if (!setting) {
        return res.status(404).json({ message: `No settings found for ${type}` });
      }
      return res.status(200).json(setting);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to update settings', message: 'Internal server error' });
    }
  };
}
