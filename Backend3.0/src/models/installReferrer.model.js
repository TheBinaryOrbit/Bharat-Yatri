import mongoose from 'mongoose';
import {
  INSTALL_APPS,
  INSTALL_PLATFORMS,
  MAX_APP_VERSION_LENGTH,
  MAX_DEVICE_ID_LENGTH,
  MAX_REFERRER_LENGTH,
  MAX_UTM_LENGTH,
} from '../constants/install.constants.js';

// One row per app install, written once by the app on its very first launch after install.
//
// This is our own copy of install attribution. Meta gets its own signal through the FB SDK and
// reports it in Ads Manager; this collection is what lets us answer "where did this install come
// from" — a Facebook ad, a WhatsApp forward, an Instagram bio link — without asking Meta, and to
// join an install to the account that eventually signed up on that device.
//
// The raw `referrer` is the record; source/medium/campaign are a parse of it kept alongside so a
// report is an index scan rather than a string search. If the parse is ever found to be wrong, the
// raw string is still there to re-derive from.
const installReferrerSchema = new mongoose.Schema(
  {
    referrer: {
      type: String,
      required: [true, 'Referrer is required'],
      trim: true,
      maxlength: [MAX_REFERRER_LENGTH, 'Referrer is too long'],
    },

    // Play's installBeginTimestampSeconds — when the install began at the store, NOT when this row
    // was written. The two differ by however long it took the user to open the app for the first
    // time, which can be days, so createdAt is not a substitute.
    installTime: {
      type: Date,
      required: [true, 'Install time is required'],
    },

    // referrerClickTimestampSeconds — when the ad/link was clicked. Optional: the click-to-install
    // gap is the interesting number, but the app is not obliged to send it.
    referrerClickTime: {
      type: Date,
      default: null,
    },

    source: { type: String, trim: true, lowercase: true, maxlength: MAX_UTM_LENGTH, default: null },
    medium: { type: String, trim: true, lowercase: true, maxlength: MAX_UTM_LENGTH, default: null },
    campaign: { type: String, trim: true, maxlength: MAX_UTM_LENGTH, default: null },
    content: { type: String, trim: true, maxlength: MAX_UTM_LENGTH, default: null },
    term: { type: String, trim: true, maxlength: MAX_UTM_LENGTH, default: null },

    // The app's own install identity (any stable per-install id it already has). Optional, but it
    // is the only thing that makes this endpoint idempotent — see the index note below — and the
    // only way /link can later attach the account that signed up on this device.
    deviceId: {
      type: String,
      trim: true,
      maxlength: MAX_DEVICE_ID_LENGTH,
    },

    app: {
      type: String,
      enum: {
        values: INSTALL_APPS,
        message: `App must be one of: ${INSTALL_APPS.join(', ')}`,
      },
      default: 'user',
    },
    platform: {
      type: String,
      enum: {
        values: INSTALL_PLATFORMS,
        message: `Platform must be one of: ${INSTALL_PLATFORMS.join(', ')}`,
      },
      default: 'android',
      lowercase: true,
      trim: true,
    },
    appVersion: {
      type: String,
      trim: true,
      maxlength: MAX_APP_VERSION_LENGTH,
      default: null,
    },

    // Filled in later by POST /link, once someone signs up on this device. Null forever for an
    // install that never converted — which is itself the number worth knowing per source.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
  },
  { timestamps: true }
);

// One install per device per app — a device can legitimately install both the rider and the driver
// app, and those are two different installs from possibly two different campaigns.
//
// partialFilterExpression, not `sparse`: a compound sparse index only skips a document that is
// missing EVERY indexed field, and `app` always has a default, so every deviceId-less row would be
// indexed under deviceId: null and the second one would collide. The partial filter indexes only
// rows that actually carry a deviceId, which is exactly the set we want deduplicated.
installReferrerSchema.index(
  { deviceId: 1, app: 1 },
  { unique: true, partialFilterExpression: { deviceId: { $type: 'string' } } }
);

// The admin listing, newest install first.
installReferrerSchema.index({ installTime: -1 });

// The reporting read: installs per source over a window.
installReferrerSchema.index({ source: 1, installTime: -1 });

export const InstallReferrer = mongoose.model('InstallReferrer', installReferrerSchema);
