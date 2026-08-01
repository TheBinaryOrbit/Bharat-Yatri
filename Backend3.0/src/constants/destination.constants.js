// Saved shortcuts ("Home", "Office") are rider-created and unbounded by nature, so the collection
// needs a ceiling somewhere. This is a UI-shaped number — a shortcut list nobody can scan is not a
// shortcut — not a storage limit.
export const QUICK_DESTINATION_LIMIT = 20;

// Longest tag a shortcut may carry. It is a chip on a search bar.
export const MAX_TAG_LENGTH = 30;

// How many recent drop locations the search bar gets as suggestions.
export const RECENT_DESTINATION_LIMIT = 5;
export const RECENT_DESTINATION_MAX_LIMIT = 20;

// Rides read per collection before de-duplication. A rider who books the same commute every day
// would yield a single suggestion from their last five rides, so the raw window has to be wider
// than the answer — this is the multiplier that widens it.
export const RECENT_DESTINATION_SCAN_FACTOR = 4;
