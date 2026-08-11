import { Setting } from '../models/setting.model.js';

export class SettingService {
  // Both platforms, for an admin dashboard listing.
  getAll = async () => {
    return Setting.find().sort({ type: 1 });
  };

  // The app's own boot read. `type` is the key, so this is the only lookup the apps ever do.
  getByType = async (type) => {
    return Setting.findOne({ type: String(type).toLowerCase() });
  };

  create = async (data) => {
    return Setting.create(data);
  };

  // Keyed by platform rather than by _id: there is one document per platform and its id is an
  // implementation detail an admin UI should not have to hold. `runValidators` keeps the version
  // pattern and build-number floor enforced on updates, not just on create.
  updateByType = async (type, data) => {
    return Setting.findOneAndUpdate({ type: String(type).toLowerCase() }, data, {
      new: true,
      runValidators: true,
    });
  };
}
