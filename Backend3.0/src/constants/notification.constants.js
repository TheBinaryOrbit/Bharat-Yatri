// The push contract with the two apps.
//
// Every notification this backend sends carries a `data` block, and `data.type` is the only field
// either app should branch on. The strings below ARE that vocabulary — changing one is a breaking
// change for a shipped app, so add rather than rename.
//
// Namespaced `<product>.<what happened>` so a client can route on the prefix alone when it does
// not yet handle a specific type: anything starting `quickride.` concerns a QuickRide, anything
// starting `outstation.` concerns an outstation trip, `kyc.` concerns onboarding.
export const NOTIFICATION_TYPES = {
  // --- Driver: work coming in -------------------------------------------------------------
  QUICKRIDE_NEW: 'quickride.new',
  QUICKRIDE_FARE_UPDATED: 'quickride.fare_updated',
  OUTSTATION_NEW: 'outstation.new',
  OUTSTATION_FARE_UPDATED: 'outstation.fare_updated',

  // --- Driver: what happened to their bid --------------------------------------------------
  QUICKRIDE_BID_ACCEPTED: 'quickride.bid_accepted',
  QUICKRIDE_BID_REJECTED: 'quickride.bid_rejected',
  QUICKRIDE_BID_EXPIRED: 'quickride.bid_expired',
  QUICKRIDE_RIDE_TAKEN: 'quickride.ride_taken',
  OUTSTATION_BID_ACCEPTED: 'outstation.bid_accepted',
  OUTSTATION_BID_REJECTED: 'outstation.bid_rejected',
  OUTSTATION_RIDE_TAKEN: 'outstation.ride_taken',

  // --- Rider: what happened to their request -----------------------------------------------
  QUICKRIDE_NO_DRIVERS: 'quickride.no_drivers',
  QUICKRIDE_ASSIGNED: 'quickride.assigned',
  OUTSTATION_NO_DRIVERS: 'outstation.no_drivers',
  OUTSTATION_BID_NEW: 'outstation.bid_new',
  OUTSTATION_ASSIGNED: 'outstation.assigned',

  // --- Both sides: the ride's own lifecycle ------------------------------------------------
  QUICKRIDE_STARTED: 'quickride.started',
  QUICKRIDE_COMPLETED: 'quickride.completed',
  QUICKRIDE_CANCELLED: 'quickride.cancelled',
  QUICKRIDE_EXPIRED: 'quickride.expired',
  OUTSTATION_ARRIVING: 'outstation.arriving',
  OUTSTATION_PICKED_UP: 'outstation.picked_up',
  OUTSTATION_COMPLETED: 'outstation.completed',
  OUTSTATION_CANCELLED: 'outstation.cancelled',
  OUTSTATION_EXPIRED: 'outstation.expired',

  // --- Driver: scheduled-trip nudges and onboarding -----------------------------------------
  OUTSTATION_REMINDER: 'outstation.reminder',
  KYC_VERIFIED: 'kyc.verified',
  KYC_REJECTED: 'kyc.rejected',
};

// Where a tap should land. Deliberately coarse: the app owns its own routing, and this is a hint
// it can honour or ignore, not a route. `data.rideId` / `data.bidId` carry what the screen needs.
export const NOTIFICATION_SCREENS = {
  DRIVER_RIDE_REQUESTS: 'driver_ride_requests', // the list of open ride cards
  DRIVER_MY_BIDS: 'driver_my_bids',
  DRIVER_ACTIVE_RIDE: 'driver_active_ride',
  DRIVER_RIDE_HISTORY: 'driver_ride_history',
  DRIVER_KYC: 'driver_kyc',
  USER_RIDE_BIDS: 'user_ride_bids', // the bids arriving on a ride the rider booked
  USER_ACTIVE_RIDE: 'user_active_ride',
  USER_RIDE_HISTORY: 'user_ride_history',
};

// Which account collection a recipient id belongs to. Chosen at the call site, never guessed:
// a driver id and a user id are both ObjectIds and nothing about the value distinguishes them.
export const NOTIFICATION_AUDIENCES = ['driver', 'user'];

// FCM refuses a data payload whose values are not strings, and Android delivers them as strings
// regardless. Both apps should therefore parse numbers/dates out of `data` themselves.
export const RIDE_TYPE_QUICKRIDE = 'quickride';
export const RIDE_TYPE_OUTSTATION = 'outstation';
