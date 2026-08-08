import { Driver } from '../models/driver.model.js';
import { User } from '../models/user.model.js';
import { FcmService } from './fcm.service.js';

// Recipients and their devices. Sits between the templates (what to say) and FcmService (how to
// put it on a phone), and owns the one piece of state either of them would otherwise have to
// know: which collection an id belongs to.
export class NotificationService {
  constructor() {
    this.fcmService = new FcmService();
  }

  // A driver id and a user id are both ObjectIds, and nothing about the value says which is which.
  // The audience is always passed down from the call site, which does know.
  modelFor = (audience) => (audience === 'driver' ? Driver : User);

  // ids → live FCM tokens. Accounts with no token (never logged in on a device, or pruned after a
  // reinstall) simply drop out here, which is why every send has to tolerate an empty result.
  resolveTokens = async (audience, ids) => {
    const unique = [...new Set((ids || []).map((id) => String(id?._id ?? id ?? '')).filter(Boolean))];
    if (!unique.length) return [];

    const accounts = await this.modelFor(audience)
      .find({ _id: { $in: unique }, fcmToken: { $nin: [null, ''] } })
      .select('fcmToken')
      .lean();

    return accounts.map((account) => account.fcmToken);
  };

  // ids → Map(id → token), for sends where each recipient gets a different message and the token
  // therefore has to stay attached to the account it came from. One query for the whole fan-out,
  // exactly like resolveTokens; the difference is only that the id survives the lookup.
  resolveTokenMap = async (audience, ids) => {
    const unique = [...new Set((ids || []).map((id) => String(id?._id ?? id ?? '')).filter(Boolean))];
    if (!unique.length) return new Map();

    const accounts = await this.modelFor(audience)
      .find({ _id: { $in: unique }, fcmToken: { $nin: [null, ''] } })
      .select('fcmToken')
      .lean();

    return new Map(accounts.map((account) => [String(account._id), account.fcmToken]));
  };

  // A device that reports "not registered" has been wiped, reinstalled or had the app removed.
  // Its token will never work again, so it is cleared rather than retried on every future event —
  // otherwise a popular route's fan-out slowly turns into a list of ghosts.
  pruneDeadTokens = async (audience, deadTokens) => {
    if (!deadTokens?.length) return;

    await this.modelFor(audience).updateMany(
      { fcmToken: { $in: deadTokens } },
      { $set: { fcmToken: '' } }
    );
  };

  // The one send path. Resolves, delivers, prunes.
  //
  // Returns a summary rather than throwing: callers are ride transitions that have already
  // committed their database write, and a failed push must never unwind one.
  send = async (audience, ids, { title, body, data }) => {
    const tokens = await this.resolveTokens(audience, ids);
    console.log(`NotificationService.send: audience=${audience}, ids=${ids.length}, tokens=${tokens.length}`);
    if (!tokens.length) return { successCount: 0, failureCount: 0, skipped: true };

    const result = await this.fcmService.sendToTokens(tokens, { title, body, data });
    await this.pruneDeadTokens(audience, result.deadTokens);

    return result;
  };

  // The per-recipient send path: one message PER id rather than one message TO all of them.
  //
  // `entries` is [{ id, message }]. Ids with no live token drop out silently, same as send().
  // Still a single database query and a single Firebase round trip per 500 recipients.
  sendEach = async (audience, entries) => {
    const list = (entries || []).filter((entry) => entry?.id && entry?.message);
    const tokens = await this.resolveTokenMap(audience, list.map((entry) => entry.id));

    const items = list.reduce((acc, { id, message }) => {
      const token = tokens.get(String(id?._id ?? id));
      if (token) acc.push({ token, ...message });
      return acc;
    }, []);

    console.log(`NotificationService.sendEach: audience=${audience}, ids=${list.length}, tokens=${items.length}`);
    if (!items.length) return { successCount: 0, failureCount: 0, skipped: true };

    const result = await this.fcmService.sendEachToTokens(items);
    await this.pruneDeadTokens(audience, result.deadTokens);

    return result;
  };

  // Direct-to-token send, for the one case with no account behind it: verifying a device's token
  // right after the app registers it.
  sendToToken = async (token, { title, body, data }) =>
    this.fcmService.sendToTokens([token], { title, body, data });

  // Binds a device to an account, and unbinds it from every other one first.
  //
  // That second half is the point, and it is why this is not just an update. An FCM token
  // identifies a HANDSET, not a person. When a driver logs out and a rider logs in on the same
  // phone, the driver row still holds that token — and the next ride offered to that driver would
  // ring on a phone the rider is now holding. Clearing it across BOTH collections is what stops
  // one person's notifications being delivered to another's screen.
  //
  // The account id comes from the caller's JWT, never from a request body: whoever holds the token
  // decides which account this device belongs to, and nobody else.
  saveToken = async (audience, accountId, fcmToken) => {
    await Promise.all([
      Driver.updateMany({ fcmToken, _id: { $ne: accountId } }, { $set: { fcmToken: '' } }),
      User.updateMany({ fcmToken, _id: { $ne: accountId } }, { $set: { fcmToken: '' } }),
    ]);

    return this.modelFor(audience)
      .findByIdAndUpdate(accountId, { $set: { fcmToken } }, { new: true })
      .select('fcmToken');
  };

  // Logout. Cheaper and more honest than waiting for the token to go stale on its own.
  clearToken = async (audience, accountId) =>
    this.modelFor(audience).findByIdAndUpdate(accountId, { $set: { fcmToken: '' } }, { new: true }).select('fcmToken');
}
