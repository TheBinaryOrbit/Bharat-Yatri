import {
  NOTIFICATION_TYPES,
  NOTIFICATION_SCREENS,
  RIDE_TYPE_QUICKRIDE,
  RIDE_TYPE_OUTSTATION,
} from '../constants/notification.constants.js';

// Every push this backend can send, in one table.
//
// Keyed by EVENT then AUDIENCE. The event names mirror the socket event names deliberately: the
// socket layer's vocabulary is already the canonical description of what just happened, and a call
// site that emits `ride:cancelled` and notifies `ride:cancelled` cannot drift. Two keys have no
// socket twin — `bid:rejected` / `outstation:bid_rejected` (the socket event there is the
// overloaded `bid:removed`, which also fires when a driver withdraws and when a bid is orphaned,
// neither of which should reach a phone) and the three that never had a socket event at all:
// `outstation:reminder`, `kyc:verified`, `kyc:rejected`.
//
// An event with no entry for an audience sends NO push. That is a feature, and it is how the
// chatty ones stay off the lock screen:
//   bid:new (QuickRide)  the rider is watching a 60-second auction; the socket already redraws
//                        the list. Its outstation twin DOES push, because there the rider may be
//                        hours away from the app.
//   bid:removed          list bookkeeping, not news.
//   ride:taken / *_expired to the silent audience — drivers who only ever saw a card. Their app
//                        removes it over the socket; a lock-screen buzz for a ride they never bid
//                        on is exactly the noise that gets an app muted.
//
// The `data` block each template returns is the app's navigation contract: `type` (added
// automatically by render(), so it can never be forgotten), `rideType`, the relevant ids, and a
// `screen` hint. FcmService coerces every value to a string on the way out.

const rupees = (amount) => `₹${Math.round(Number(amount) || 0)}`;

// "3 hours", "1 hour", "30 minutes" — for reminder copy, from a whole number of minutes.
const humanizeMinutes = (minutes) => {
  const total = Math.round(Number(minutes) || 0);
  if (total < 60) return `${total} minutes`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const hourPart = `${hours} hour${hours === 1 ? '' : 's'}`;

  return rest ? `${hourPart} ${rest} min` : hourPart;
};

// "Andheri East → Bandra West", trimmed of the long tail Google returns.
const shortPlace = (name) => String(name || '').split(',')[0].trim();

// Distances go out as data, and a raw Redis GEO result is 2.4000000000000004. One decimal is the
// most an app would ever render, and it keeps the string the app parses short and stable.
const km = (value) => {
  if (value === null || value === undefined || value === '') return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : undefined;
};

const route = (payload) =>
  `${shortPlace(payload.pickupLocationName)} → ${shortPlace(payload.dropLocationName)}`;

const rideId = (payload) => payload.rideId ?? payload.quickRideId ?? payload.outstationRideId;

export const NOTIFICATION_TEMPLATES = {
  // ===========================================================================================
  // QuickRide — work offered to drivers
  // ===========================================================================================
  // The one push that has to survive being tapped from a cold start: the driver app renders the
  // whole ride card — route, fare, trip length, how far the pickup is — and an honest countdown
  // from `expiresAt`, without waiting on a fetch. So this data block carries the card, not just a
  // navigation hint. `distanceFromDriverKm` is why dispatch sends these one-per-driver.
  'ride:request': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_NEW,
      title: `New ride • ${rupees(payload.offeredFare)}`,
      body: `${route(payload)} · ${Math.round(payload.estimatedDistanceKm || 0)} km trip`,
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        offeredFare: payload.offeredFare,
        expiresAt: payload.expiresAt,
        pickup: shortPlace(payload.pickupLocationName),
        drop: shortPlace(payload.dropLocationName),
        estimatedDistanceKm: km(payload.estimatedDistanceKm),
        distanceFromDriverKm: km(payload.distanceFromDriverKm),
        // The band a bid must fall inside, flattened out of `bidBounds`. FCM data values are
        // strings, so the nested object the socket card carries would arrive as "[object Object]".
        minFare: payload.bidBounds?.min,
        maxFare: payload.bidBounds?.max,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // The rider raised their offer. Goes to the whole re-dispatched audience, which is both the
  // drivers who already hold the card and those who came online since — one push covers both,
  // which is why the bidders' own `ride:fare_updated` emit does not also notify.
  'ride:fare_updated': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_FARE_UPDATED,
      title: `Fare raised to ${rupees(payload.offeredFare)}`,
      body: `${route(payload)} · the rider increased their offer`,
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        offeredFare: payload.offeredFare,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // ===========================================================================================
  // QuickRide — bid outcomes
  // ===========================================================================================
  'bid:accepted': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_BID_ACCEPTED,
      title: 'Your bid was accepted 🎉',
      body: `${rupees(payload.finalFare)} · head to the pickup point`,
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        screen: NOTIFICATION_SCREENS.DRIVER_ACTIVE_RIDE,
      },
    }),
  },

  'bid:rejected': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_BID_REJECTED,
      title: 'Bid declined',
      body: 'The rider passed on your offer. You can bid again with a lower fare.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        bidId: payload.bidId,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  'bid:expired': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_BID_EXPIRED,
      title: 'Bid expired',
      body: 'Your bid ran out before the rider chose. Bid again if the ride is still open.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        bidId: payload.bidId,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // Sent only to drivers who actually bid and lost. The silent audience gets the socket event
  // and no push — see the note at the top of this file.
  'ride:taken': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_RIDE_TAKEN,
      title: 'Ride taken',
      body: 'Another driver won this ride. New requests are on the way.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        bidId: payload.bidId,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // ===========================================================================================
  // QuickRide — the ride's own lifecycle
  // ===========================================================================================
  'ride:no_drivers': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_NO_DRIVERS,
      title: 'No drivers nearby yet',
      body: 'We are still looking. Raising your fare usually helps.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'ride:assigned': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_ASSIGNED,
      title: 'Driver on the way 🚗',
      body: `${payload.ride?.assignedTo?.name || 'Your driver'} accepted at ${rupees(payload.finalFare)}. Share your OTP to start.`,
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'ride:started': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_STARTED,
      title: 'Ride started',
      body: 'You are on your way. Have a safe trip!',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'ride:completed': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_COMPLETED,
      title: 'Ride completed',
      body: `${rupees(payload.finalFare)} payable. Thanks for riding with Bharat Yaatri!`,
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
    // No driver entry: the driver is the one who tapped "complete" and is looking at the
    // settlement screen. Buzzing someone about the button they just pressed is how an app
    // teaches people to turn notifications off. Same reasoning for `outstation:completed`,
    // `outstation:started` and `outstation:picked_up` below.
  },

  'ride:cancelled': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_CANCELLED,
      title: 'Ride cancelled',
      body: payload.cancellationReason
        ? `Your driver cancelled: ${payload.cancellationReason}`
        : 'Your driver cancelled this ride. Book again to find another.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        cancelledBy: payload.cancelledBy,
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_CANCELLED,
      title: 'Ride cancelled',
      body: payload.cancellationReason
        ? `The rider cancelled: ${payload.cancellationReason}`
        : 'The rider cancelled this ride.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        cancelledBy: payload.cancelledBy,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_HISTORY,
      },
    }),
  },

  'ride:expired': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_EXPIRED,
      title: 'No driver found',
      body: 'Nobody accepted your ride in time. Try booking again.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
    // Only the drivers who had money on it — a bidder whose ride died under them.
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.QUICKRIDE_EXPIRED,
      title: 'Ride expired',
      body: 'The rider stopped searching before choosing a driver.',
      data: {
        rideType: RIDE_TYPE_QUICKRIDE,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // ===========================================================================================
  // Outstation — work offered to drivers
  // ===========================================================================================
  'outstation:request': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_NEW,
      title: `Outstation trip • ${rupees(payload.offeredFare)}`,
      body: `${route(payload)} · ${Math.round(payload.estimatedDistanceKm || 0)} km`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        offeredFare: payload.offeredFare,
        bookingType: payload.bookingType,
        pickupAt: payload.pickupAt,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  'outstation:fare_updated': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_FARE_UPDATED,
      title: `Fare raised to ${rupees(payload.offeredFare)}`,
      body: `${route(payload)} · the rider increased their offer`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        offeredFare: payload.offeredFare,
        pickupAt: payload.pickupAt,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // ===========================================================================================
  // Outstation — bid outcomes
  // ===========================================================================================
  'outstation:bid_accepted': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_BID_ACCEPTED,
      title: 'Outstation trip confirmed 🎉',
      body: `${rupees(payload.finalFare)} · pickup ${payload.pickupAt ? new Date(payload.pickupAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon'}`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        pickupAt: payload.pickupAt,
        screen: NOTIFICATION_SCREENS.DRIVER_ACTIVE_RIDE,
      },
    }),
  },

  'outstation:bid_rejected': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_BID_REJECTED,
      title: 'Bid declined',
      body: 'The rider passed on your offer. You can bid again with a lower fare.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        bidId: payload.bidId,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  'outstation:ride_taken': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_RIDE_TAKEN,
      title: 'Trip taken',
      body: 'Another driver won this outstation trip.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        bidId: payload.bidId,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // The outstation half of `bid:new` DOES push, unlike QuickRide's. A QuickRide rider is staring
  // at a 60-second auction; an outstation rider booked a trip for next Friday and closed the app.
  'outstation:bid_new': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_BID_NEW,
      title: `New offer • ${rupees(payload.bid?.fare)}`,
      body: `${payload.bid?.requestedBy?.name || 'A driver'} bid on your outstation trip.`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        bidId: payload.bid?._id,
        fare: payload.bid?.fare,
        screen: NOTIFICATION_SCREENS.USER_RIDE_BIDS,
      },
    }),
  },

  // ===========================================================================================
  // Outstation — the ride's own lifecycle
  // ===========================================================================================
  'outstation:no_drivers': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_NO_DRIVERS,
      title: 'No drivers nearby yet',
      body: 'Your trip is still listed. Drivers browsing outstation work can still find it.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'outstation:assigned': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_ASSIGNED,
      title: 'Driver confirmed 🚗',
      body: `${payload.ride?.assignedTo?.name || 'Your driver'} will take your trip at ${rupees(payload.finalFare)}.`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        pickupAt: payload.pickupAt,
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  // The driver tapped "on my way" — the one moment an outstation trip becomes trackable.
  'outstation:started': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_ARRIVING,
      title: 'Your driver is on the way',
      body: 'Track them live and keep your OTP handy.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'outstation:picked_up': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_PICKED_UP,
      title: 'Trip started',
      body: 'You are on your way. Have a safe journey!',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_ACTIVE_RIDE,
      },
    }),
  },

  'outstation:completed': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_COMPLETED,
      title: 'Trip completed',
      body: `${rupees(payload.finalFare)} payable. Thanks for riding with Bharat Yaatri!`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        finalFare: payload.finalFare,
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
  },

  'outstation:ride_cancelled': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_CANCELLED,
      title: 'Trip cancelled',
      body: payload.cancellationReason
        ? `Your driver cancelled: ${payload.cancellationReason}`
        : 'Your driver cancelled this trip. Book again to find another.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        cancelledBy: payload.cancelledBy,
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_CANCELLED,
      title: 'Trip cancelled',
      body: payload.cancellationReason
        ? `The rider cancelled: ${payload.cancellationReason}`
        : 'The rider cancelled this trip.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        cancelledBy: payload.cancelledBy,
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_HISTORY,
      },
    }),
  },

  'outstation:ride_expired': {
    user: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_EXPIRED,
      title: 'No driver found',
      body: 'Your outstation trip expired without a driver. Try booking again.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.USER_RIDE_HISTORY,
      },
    }),
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_EXPIRED,
      title: 'Trip expired',
      body: 'The rider stopped searching before choosing a driver.',
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        screen: NOTIFICATION_SCREENS.DRIVER_RIDE_REQUESTS,
      },
    }),
  },

  // ===========================================================================================
  // Outstation — the departure ladder
  // ===========================================================================================
  // One template for every rung. `leadMinutes` is what the sweeper decided is due, so 3h / 2h / 1h
  // / 30m all render from here and adding a rung to OUTSTATION_REMINDER_OFFSETS_MINUTES needs no
  // change in this file.
  'outstation:reminder': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.OUTSTATION_REMINDER,
      title: `Trip in ${humanizeMinutes(payload.leadMinutes)}`,
      body: `${route(payload)} · be ready to set off`,
      data: {
        rideType: RIDE_TYPE_OUTSTATION,
        rideId: rideId(payload),
        pickupAt: payload.pickupAt,
        leadMinutes: payload.leadMinutes,
        screen: NOTIFICATION_SCREENS.DRIVER_ACTIVE_RIDE,
      },
    }),
  },

  // ===========================================================================================
  // Onboarding
  // ===========================================================================================
  'kyc:verified': {
    driver: () => ({
      type: NOTIFICATION_TYPES.KYC_VERIFIED,
      title: 'KYC verified ✅',
      body: 'You are verified. Complete your profile and start accepting rides.',
      data: { screen: NOTIFICATION_SCREENS.DRIVER_KYC },
    }),
  },

  'kyc:rejected': {
    driver: (payload) => ({
      type: NOTIFICATION_TYPES.KYC_REJECTED,
      title: 'KYC could not be verified',
      body: payload.reason || 'Your KYC could not be verified. Please try again.',
      data: {
        reason: payload.reason,
        screen: NOTIFICATION_SCREENS.DRIVER_KYC,
      },
    }),
  },
};

// event + audience → the message, or null when this combination is deliberately socket-only.
//
// `type` is merged into `data` here rather than repeated in each template, so a new template
// physically cannot ship without the one field both apps branch on.
export const renderNotification = (event, audience, payload = {}) => {
  const template = NOTIFICATION_TEMPLATES[event]?.[audience];
  if (!template) return null;

  const { type, title, body, data } = template(payload);

  return { title, body, data: { ...data, type } };
};
