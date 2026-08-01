import { env } from '../config/env.js';

// The shareable live-tracking link. Falls back to the bare token when no front-end base is
// configured, so a development environment still gets something it can paste into /track/:token.
//
// Lives here rather than on a controller because both ride modules and both of their bid
// controllers build it, and the URL shape is a contract with the tracking page — one copy.
export const buildTrackingUrl = (trackingToken) => {
  if (!trackingToken) return null;
  return env.TRACKING_LINK_BASE_URL ? `${env.TRACKING_LINK_BASE_URL}/${trackingToken}` : trackingToken;
};
