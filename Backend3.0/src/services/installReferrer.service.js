import { InstallReferrer } from '../models/installReferrer.model.js';

export class InstallReferrerService {
  // Idempotent whenever the app sends a deviceId: the first write wins, and every later call for
  // that device returns the original row untouched.
  //
  // $setOnInsert rather than $set on purpose. A reinstall, a restored backup or a retry after a
  // network failure must never overwrite the first attribution we saw — the *first* referrer is the
  // one that explains the install. `created` tells the controller whether this call was the write
  // that landed, which is what the app needs to decide it can stop retrying.
  //
  // Without a deviceId there is nothing to deduplicate on, so the app's own first-launch flag is
  // the only guard and a plain insert is the honest behaviour.
  record = async ({ deviceId, app, ...rest }) => {
    if (!deviceId) {
      const install = await InstallReferrer.create({ app, ...rest });
      return { install, created: true };
    }

    // updatedAt is written by hand here. Left to mongoose it would be a plain $set, so a duplicate
    // post — which changes nothing — would still stamp the row as modified; and switching the
    // option off entirely omits the field on insert, leaving these documents shaped differently
    // from every other one in the collection. $setOnInsert gives both: present on the real write,
    // untouched by every retry after it.
    const now = new Date();

    const result = await InstallReferrer.findOneAndUpdate(
      { deviceId, app },
      { $setOnInsert: { ...rest, updatedAt: now } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
        includeResultMetadata: true,
        timestamps: { updatedAt: false },
      }
    );

    return { install: result.value, created: !result.lastErrorObject?.updatedExisting };
  };

  // Attaches the account that signed up on this device. `field` is 'userId' or 'driverId' — chosen
  // from the caller's JWT role, never from the request body.
  linkAccount = async ({ deviceId, app, field, accountId }) => {
    return InstallReferrer.findOneAndUpdate(
      { deviceId, app },
      { $set: { [field]: accountId } },
      { new: true }
    );
  };

  list = async (filter, { limit, skip = 0 } = {}) => {
    return InstallReferrer.find(filter)
      .sort({ installTime: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name phoneNumber')
      .populate('driverId', 'name phoneNumber');
  };

  count = async (filter) => {
    return InstallReferrer.countDocuments(filter);
  };

  // Installs per source, with how many of them went on to create an account. The conversion column
  // is the whole point of storing this ourselves: Ads Manager can tell us a campaign drove installs,
  // but only we know which of those installs became a rider or a driver.
  //
  // Sources are grouped under 'unknown' when the referrer carried no utm_source — Meta's own ad
  // payload often does not, and dropping those rows would understate the total.
  sourceBreakdown = async (filter) => {
    return InstallReferrer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { source: { $ifNull: ['$source', 'unknown'] }, medium: { $ifNull: ['$medium', 'unknown'] } },
          installs: { $sum: 1 },
          signups: {
            $sum: { $cond: [{ $or: [{ $ne: ['$userId', null] }, { $ne: ['$driverId', null] }] }, 1, 0] },
          },
          lastInstallAt: { $max: '$installTime' },
        },
      },
      {
        $project: {
          _id: 0,
          source: '$_id.source',
          medium: '$_id.medium',
          installs: 1,
          signups: 1,
          lastInstallAt: 1,
        },
      },
      { $sort: { installs: -1, source: 1 } },
    ]);
  };
}
