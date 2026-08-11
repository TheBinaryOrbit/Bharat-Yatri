// One settings document per app store build target. `type` is the key, so there are exactly two
// documents in the collection and an app fetches its own by name at boot.
export const SETTING_TYPES = ['android', 'ios'];

// "3", "3.1", "3.1.4" — up to three dot-separated numbers. Deliberately looser than strict semver
// (no pre-release or build suffix): a store version string is what this mirrors, and neither
// Play Console nor App Store Connect accepts those suffixes.
export const APP_VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;

// The store's own integer, and the only field a force-update check should compare. Version strings
// are compared wrong by every app that tries ("3.10.0" < "3.9.0" as a string); build numbers are
// monotonic integers precisely so they can be compared with `<`.
export const MIN_BUILD_NUMBER = 1;
