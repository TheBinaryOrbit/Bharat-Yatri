import mongoose from 'mongoose';
import { SETTING_TYPES, APP_VERSION_PATTERN, MIN_BUILD_NUMBER } from '../constants/setting.constants.js';

// A promotional card on the rider's home screen. Kept as a subdocument rather than its own
// collection because banners are only ever read as one platform's short ordered list — the same
// reasoning as quickDestination's "no 2dsphere index": nothing queries them any other way.
//
// `_id` is left on (unlike the GeoJSON point subdocuments elsewhere) so an admin UI has a stable
// handle for the row it is editing.
const promotionalBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Banner image URL is required'],
      trim: true,
    },
    // Where a tap goes. Free-form so it can hold an https link or an in-app deep link.
    linkUrl: {
      type: String,
      trim: true,
    },
    // Ascending display order. Ties fall back to insertion order, which is array order.
    order: {
      type: Number,
      default: 0,
    },
    // Lets a seasonal banner be parked without losing its copy and artwork.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Everything the apps need to configure themselves at boot, in one document per platform.
//
// The version block is genuinely per-platform — a build ships to one store at a time — and the
// content blocks are stored per-platform too rather than in a shared singleton, because App Store
// review regularly requires iOS to show different copy or a different onboarding destination from
// Android. The cost is that identical content is written twice; the benefit is that one GET
// returns a complete, self-consistent configuration for the caller with no merge step.
const settingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: SETTING_TYPES,
        message: `Type must be one of: ${SETTING_TYPES.join(', ')}`,
      },
      unique: true, // exactly one document per platform
      lowercase: true,
      trim: true,
    },

    // --- The store build ------------------------------------------------------------------
    appVersion: {
      type: String,
      required: [true, 'App version is required'],
      trim: true,
      match: [APP_VERSION_PATTERN, 'App version must look like 1, 1.2 or 1.2.3'],
    },
    appBuildNumber: {
      type: Number,
      required: [true, 'App build number is required'],
      min: [MIN_BUILD_NUMBER, `App build number must be at least ${MIN_BUILD_NUMBER}`],
    },
    // True blocks the app until the user updates; false offers a dismissible nudge. Defaults to
    // false so a routine version bump cannot lock every phone out by omission.
    isUpdateMandatory: {
      type: Boolean,
      default: false,
    },

    // --- Content --------------------------------------------------------------------------
    // Where the "get started" / onboarding walkthrough lives.
    onboardingLink: {
      type: String,
      trim: true,
      default: '',
    },
    // HTML, rendered in a webview on the home screen. Same storage decision as appContent.content:
    // the apps render markup they are given rather than modelling every block type here.
    homePageContent: {
      type: String,
      default: '',
    },
    userPromotionalBanners: {
      type: [promotionalBannerSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const Setting = mongoose.model('Setting', settingSchema);
