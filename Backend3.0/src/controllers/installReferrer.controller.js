import { InstallReferrerService } from '../services/installReferrer.service.js';
import { parseInstallReferrer, toInstallDate } from '../utils/referrer.js';
import { parseDateRange } from '../utils/dateRange.js';
import {
  DEFAULT_INSTALL_PAGE_SIZE,
  INSTALL_APPS,
  INSTALL_PLATFORMS,
  MAX_INSTALL_PAGE_SIZE,
  MAX_REFERRER_LENGTH,
} from '../constants/install.constants.js';

// The app posts snake_case, because that is the shape the Play Install Referrer payload is written
// in on the client. camelCase aliases are accepted for every field so neither side has to care.
const pick = (body, ...keys) => keys.map((key) => body[key]).find((value) => value !== undefined);

export class InstallReferrerController {
  constructor() {
    this.installReferrerService = new InstallReferrerService();
  }

  // POST /api/v3/install-referrers   → PUBLIC (fired before anyone has logged in)
  //
  // Called once, on the app's very first launch after install. There is no auth on this route by
  // necessity: the whole point is to capture where an install came from, which happens long before
  // a signup. That makes the endpoint spoofable in principle — treat this collection as marketing
  // signal, never as anything a payout or a permission depends on.
  record = async (req, res) => {
    const body = req.body ?? {};

    const referrer = pick(body, 'referrer', 'installReferrer');
    const installTimeRaw = pick(body, 'install_time', 'installTime', 'installBeginTimestampSeconds');
    const clickTimeRaw = pick(body, 'referrer_click_time', 'referrerClickTime', 'referrerClickTimestampSeconds');
    const deviceId = pick(body, 'device_id', 'deviceId');
    const appVersion = pick(body, 'app_version', 'appVersion');
    const { app = 'user', platform = 'android' } = body;

    const errors = [];

    if (typeof referrer !== 'string' || !referrer.trim()) {
      errors.push({ field: 'referrer', message: 'Referrer is required' });
    } else if (referrer.length > MAX_REFERRER_LENGTH) {
      errors.push({ field: 'referrer', message: `Referrer cannot be longer than ${MAX_REFERRER_LENGTH} characters` });
    }

    const installTime = toInstallDate(installTimeRaw);
    if (!installTime) {
      errors.push({ field: 'install_time', message: 'install_time must be a UNIX timestamp in seconds' });
    }

    // Optional, so only a value that was sent AND is unusable is an error.
    const referrerClickTime = toInstallDate(clickTimeRaw);
    if (clickTimeRaw !== undefined && clickTimeRaw !== null && !referrerClickTime) {
      errors.push({ field: 'referrer_click_time', message: 'referrer_click_time must be a UNIX timestamp in seconds' });
    }

    if (!INSTALL_APPS.includes(app)) {
      errors.push({ field: 'app', message: `App must be one of: ${INSTALL_APPS.join(', ')}` });
    }
    if (!INSTALL_PLATFORMS.includes(String(platform).toLowerCase())) {
      errors.push({ field: 'platform', message: `Platform must be one of: ${INSTALL_PLATFORMS.join(', ')}` });
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Install referrer is invalid', errors });
    }

    try {
      const { install, created } = await this.installReferrerService.record({
        referrer: referrer.trim(),
        installTime,
        referrerClickTime,
        ...parseInstallReferrer(referrer),
        deviceId: typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : undefined,
        app,
        platform: String(platform).toLowerCase(),
        appVersion: typeof appVersion === 'string' && appVersion.trim() ? appVersion.trim() : null,
      });

      // 200 rather than an error when the row already existed: a retry is a success from the app's
      // point of view, and answering 409 would push a correct client into a pointless retry loop.
      return res.status(created ? 201 : 200).json({ created, data: install });
    } catch (error) {
      console.log(error);

      // Two first launches racing each other — the loser lost by a millisecond, and the winner's
      // row is the one we wanted anyway.
      if (error.code === 11000) {
        return res.status(200).json({ created: false, message: 'Install referrer already recorded' });
      }
      return res.status(500).json({ error: 'Failed to record install referrer', message: 'Internal server error' });
    }
  };

  // POST /api/v3/install-referrers/link   (auth required)
  //
  // Call this right after a signup completes, from the same device that posted the referrer. It
  // attaches the new account to its install so a source can be measured on signups, not just on
  // installs. Requires that the app sent a device_id on the original post.
  //
  // The account is taken from the JWT and never from the body — a caller may only link the identity
  // it is actually authenticated as.
  link = async (req, res) => {
    const deviceId = pick(req.body ?? {}, 'device_id', 'deviceId');

    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        message: 'device_id is required',
        errors: [{ field: 'device_id', message: 'device_id is required' }],
      });
    }

    const isDriver = req.role === 'driver';

    try {
      const install = await this.installReferrerService.linkAccount({
        deviceId: deviceId.trim(),
        app: isDriver ? 'driver' : 'user',
        field: isDriver ? 'driverId' : 'userId',
        accountId: req.user._id,
      });

      // Not an error: most installs on a device we have no referrer row for are simply installs
      // that predate this feature, or a device that never had a referrer to report.
      if (!install) {
        return res.status(200).json({ linked: false, message: 'No install referrer recorded for this device' });
      }

      return res.status(200).json({ linked: true, data: install });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to link install referrer', message: 'Internal server error' });
    }
  };

  // GET /api/v3/install-referrers   (admin only)
  // Filters: app, source, medium, campaign, linked=true|false, date | from/to, limit, skip
  list = async (req, res) => {
    const errors = [];
    const { app, source, medium, campaign, linked } = req.query;

    if (app !== undefined && !INSTALL_APPS.includes(app)) {
      errors.push({ field: 'app', message: `App must be one of: ${INSTALL_APPS.join(', ')}` });
    }
    if (linked !== undefined && linked !== 'true' && linked !== 'false') {
      errors.push({ field: 'linked', message: "linked must be 'true' or 'false'" });
    }

    const installTime = parseDateRange(req.query, errors);
    if (errors.length) {
      return res.status(400).json({ message: 'Query is invalid', errors });
    }

    const filter = {
      ...(app && { app }),
      ...(source && { source: String(source).toLowerCase() }),
      ...(medium && { medium: String(medium).toLowerCase() }),
      ...(campaign && { campaign }),
      ...(installTime && { installTime }),
      // "Did this install ever become an account?" — either ref being set counts.
      ...(linked === 'true' && { $or: [{ userId: { $ne: null } }, { driverId: { $ne: null } }] }),
      ...(linked === 'false' && { userId: null, driverId: null }),
    };

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_INSTALL_PAGE_SIZE)
      : DEFAULT_INSTALL_PAGE_SIZE;

    const requestedSkip = Number(req.query.skip);
    const skip = Number.isFinite(requestedSkip) ? Math.max(Math.trunc(requestedSkip), 0) : 0;

    try {
      const [items, total] = await Promise.all([
        this.installReferrerService.list(filter, { limit, skip }),
        this.installReferrerService.count(filter),
      ]);

      return res.status(200).json({ total, count: items.length, limit, skip, data: items });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch install referrers', message: 'Internal server error' });
    }
  };

  // GET /api/v3/install-referrers/summary   (admin only)
  // Installs and signups grouped by source/medium. Same date + app filters as the listing.
  summary = async (req, res) => {
    const errors = [];
    const { app } = req.query;

    if (app !== undefined && !INSTALL_APPS.includes(app)) {
      errors.push({ field: 'app', message: `App must be one of: ${INSTALL_APPS.join(', ')}` });
    }

    const installTime = parseDateRange(req.query, errors);
    if (errors.length) {
      return res.status(400).json({ message: 'Query is invalid', errors });
    }

    const filter = {
      ...(app && { app }),
      ...(installTime && { installTime }),
    };

    try {
      const rows = await this.installReferrerService.sourceBreakdown(filter);
      const totalInstalls = rows.reduce((sum, row) => sum + row.installs, 0);
      const totalSignups = rows.reduce((sum, row) => sum + row.signups, 0);

      return res.status(200).json({ totalInstalls, totalSignups, count: rows.length, data: rows });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to build install summary', message: 'Internal server error' });
    }
  };
}
