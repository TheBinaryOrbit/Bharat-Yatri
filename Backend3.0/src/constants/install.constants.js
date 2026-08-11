// Which of the two apps an install belongs to. Deliberately the same two words as AppContent's
// `type`, so an attribution report and a content query can be filtered by the same value with no
// translation table in between.
export const INSTALL_APPS = ['user', 'driver'];

// iOS is listed even though only Android has a Play Install Referrer, because the same row is what
// an iOS build would write if it ever posts one — the column should not have to be migrated then.
export const INSTALL_PLATFORMS = ['android', 'ios'];

// Google caps a referrer at far less than this in practice. The bound is here to stop an app (or
// anything else that finds this open endpoint) writing an unbounded blob into the collection.
export const MAX_REFERRER_LENGTH = 1024;

// Individual utm_* values, after parsing. A campaign name longer than this is a mistake, not a name.
export const MAX_UTM_LENGTH = 256;

export const MAX_DEVICE_ID_LENGTH = 128;

export const MAX_APP_VERSION_LENGTH = 32;

// Admin listing page size.
export const DEFAULT_INSTALL_PAGE_SIZE = 50;
export const MAX_INSTALL_PAGE_SIZE = 200;
