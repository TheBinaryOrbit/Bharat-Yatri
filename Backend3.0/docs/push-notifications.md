# Push Notifications — Backend & App Guide

Firebase Cloud Messaging for both apps: what gets sent, when, what the `data`
block contains, and how to route a tap to the right screen.

Related: [QuickRide — Driver](./driver-quick-ride.md) ·
[Outstation — Driver](./driver-outstation-ride.md) ·
[User App Guide](./user-app-guide.md) · [Driver KYC](./driver-kyc.md)

---

## The one rule

**Push is a mirror of the socket layer, never a replacement for it.**

Every notification below corresponds to a socket event the app already handles.
Sockets are the source of truth and carry the full payload; push exists to reach
a phone whose app is closed or backgrounded. If a device is online and connected,
it will normally get both — the socket event first.

Consequences for the apps:

- **Never treat a notification as state.** On tap, call the relevant GET
  (`/quick-rides/live`, `/outstation-rides/live`, `/quick-rides/:id`) and render
  from that. `data` carries ids for navigation, not a ride.
- **No credentials are ever pushed.** The start OTP and the tracking token are
  deliberately absent from every payload — notifications are rendered on locked
  screens and cached by the OS. They stay in the socket payload and the HTTP
  response, which need an open, authenticated app to read.

---

## Setup

### Server

Three variables from the Firebase service-account JSON
(*console → Project settings → Service accounts → Generate new private key*):

```
FIREBASE_PROJECT_ID=bharat-yaatri-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"

PUSH_ENABLED=true
OUTSTATION_REMINDER_OFFSETS_MINUTES=180,120,60,30
REMINDER_SWEEP_INTERVAL_MS=60000
```

The private key must keep its literal `\n` escapes and stay double-quoted.

Missing or broken credentials are **not fatal**. The server logs
`⚠️ Push notifications disabled` and runs normally — sockets are unaffected.
`PUSH_ENABLED=false` does the same deliberately.

### Android channel

Every message is sent on channel id **`bharat_yatri_rides`** at high priority.
The app must create that channel with `IMPORTANCE_HIGH`, or Android silently
downgrades a new-ride alert to a silent one.

### Registering a device

`POST /auth/verify` already accepts an `fcmToken` at login, but that alone is not
enough: FCM rotates a token on reinstall, on restore-from-backup and
occasionally on its own. Call this on **every** `onTokenRefresh`:

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| `PATCH` | `/api/v3/notifications/token` | user **or** driver | `{ "fcmToken": "..." }` |
| `DELETE` | `/api/v3/notifications/token` | user **or** driver | — (call on logout) |
| `POST` | `/api/v3/notifications/test` | user **or** driver | `{ title?, body? }` — dev only, 404 in production |

Registering a token **unbinds it from every other account, in both
collections.** A handset belongs to one identity at a time; without this a
driver who logs out would keep receiving ride offers on a phone the next rider is
holding. `DELETE` on logout is still the right thing to do.

A token that Firebase reports as dead is cleared automatically on the next send.

---

## The payload

```jsonc
{
  "notification": { "title": "New ride • ₹280", "body": "Andheri East → Bandra West · 12 km trip" },
  "data": {
    "type": "quickride.new",            // the ONLY field to branch on
    "rideType": "quickride",            // "quickride" | "outstation"
    "rideId": "68f0…aa",
    "screen": "driver_ride_requests",   // routing hint
    "offeredFare": "280"                // NOTE: a string
  }
}
```

**Every `data` value is a string.** FCM rejects anything else, so numbers are
stringified and dates are ISO-8601 on the way out. Parse them client-side. Keys
that would have been `null` are omitted rather than sent as `"null"`.

`screen` values: `driver_ride_requests`, `driver_my_bids`, `driver_active_ride`,
`driver_ride_history`, `driver_kyc`, `user_ride_bids`, `user_active_ride`,
`user_ride_history`.

### `quickride.new` carries the whole card

Most `data` blocks are a navigation hint. This one is not: a driver's ride offer
has to be renderable — and countable-down — from a cold start, before any fetch
returns.

```jsonc
{
  "notification": {
    "title": "New ride • ₹280",
    "body": "Andheri East → Bandra West · 12 km trip"
  },
  "data": {
    "type": "quickride.new",
    "rideType": "quickride",
    "rideId": "68f0…aa",
    "offeredFare": "280",
    "expiresAt": "2026-08-08T10:31:00.000Z",  // ISO-8601 — drive the countdown off this
    "pickup": "Andheri East",                 // short form, comma tail trimmed
    "drop": "Bandra West",
    "estimatedDistanceKm": "12",              // trip length
    "distanceFromDriverKm": "2.4",            // pickup's distance from THIS driver, 1 dp
    "minFare": "224",                         // your bid must land in [minFare, maxFare]
    "maxFare": "336",
    "screen": "driver_ride_requests"
  }
}
```

`minFare` / `maxFare` are the bid band — the flattened `bidBounds` the socket
card carries as a nested object, which `data` cannot hold because every value
must be a string. They track the rider's **offered** fare, so a
`quickride.fare_updated` push means the band you cached from this one is stale;
re-read the bounds from the ride rather than reusing them.

`distanceFromDriverKm` is per-recipient, so this event is sent as one message
per driver (Firebase `sendEach`) rather than a multicast. It is omitted when
dispatch had no distance for that driver. Every other value is ride-level and
identical across the ring.

Do **not** count down from a locally-captured receipt time: the push may have sat
in Firebase, or the phone may have been dozing. `expiresAt` is the only honest
clock.

---

## Driver notifications

| `type` | When | Extra `data` |
| --- | --- | --- |
| `quickride.new` | A ride is dispatched to you | `offeredFare`, `expiresAt`, `pickup`, `drop`, `estimatedDistanceKm`, `distanceFromDriverKm`, `minFare`, `maxFare` |
| `quickride.fare_updated` | The rider raised their offer (re-dispatch) | `offeredFare` |
| `quickride.bid_accepted` | **You won the ride** | `finalFare` |
| `quickride.bid_rejected` | The rider dismissed your bid | `bidId` |
| `quickride.bid_expired` | Your 60s bid ran out | `bidId` |
| `quickride.ride_taken` | Another driver won — *bidders only* | `bidId` |
| `quickride.expired` | The ride expired — *bidders only* | — |
| `quickride.cancelled` | The **rider** cancelled | `cancelledBy` |
| `outstation.new` | An outstation trip is dispatched to you | `offeredFare`, `bookingType`, `pickupAt` |
| `outstation.fare_updated` | The rider raised their offer | `offeredFare`, `pickupAt` |
| `outstation.bid_accepted` | **You won the trip** | `finalFare`, `pickupAt` |
| `outstation.bid_rejected` | The rider dismissed your bid | `bidId` |
| `outstation.ride_taken` | Another driver won — *bidders only* | `bidId` |
| `outstation.expired` | The trip expired — *bidders only* | — |
| `outstation.cancelled` | The **rider** cancelled | `cancelledBy` |
| `outstation.reminder` | Your trip departs soon | `pickupAt`, `leadMinutes` |
| `kyc.verified` | DigiLocker verification succeeded | — |
| `kyc.rejected` | DigiLocker verification failed | `reason` |

## Rider notifications

| `type` | When | Extra `data` |
| --- | --- | --- |
| `quickride.no_drivers` | No driver was found in range | — |
| `quickride.assigned` | **A driver accepted** | `finalFare` |
| `quickride.started` | The driver entered your OTP | — |
| `quickride.completed` | Trip finished | `finalFare` |
| `quickride.cancelled` | The **driver** cancelled | `cancelledBy` |
| `quickride.expired` | Nobody accepted in time | — |
| `outstation.no_drivers` | No driver was found in range | — |
| `outstation.bid_new` | **A driver bid on your trip** | `bidId`, `fare` |
| `outstation.assigned` | **A driver accepted** | `finalFare`, `pickupAt` |
| `outstation.arriving` | The driver set off — tracking is now live | — |
| `outstation.picked_up` | The driver entered your OTP | — |
| `outstation.completed` | Trip finished | `finalFare` |
| `outstation.cancelled` | The **driver** cancelled | `cancelledBy` |
| `outstation.expired` | Nobody accepted in time | — |

---

## What deliberately does NOT push

Not every socket event earns a place on a lock screen. These stay socket-only,
and that is a design decision rather than an omission:

| Event | Why not |
| --- | --- |
| QuickRide `bid:new` (to the rider) | The rider is watching a 60-second auction with the app open. Its **outstation twin does push** — that rider booked a trip for next Friday and closed the app. |
| `bid:removed` (either side) | List bookkeeping. Only the rider actively *rejecting* a bid pushes, as `*.bid_rejected`. |
| `ride:taken` / `*_expired` / `*_cancelled` to the **silent audience** | Drivers who were shown a card and never bid. Their app removes the card over the socket; a buzz about a ride they ignored is exactly the noise that gets an app muted. Drivers who **bid** are always notified. |
| Anything to the person who caused it | The driver who tapped *complete*, the rider who tapped *cancel*. Nobody is notified about their own action — which is why, on a cancel, only the *other* party is pushed. |

---

## Outstation departure reminders

The assigned driver is reminded on a ladder of rungs, set by
`OUTSTATION_REMINDER_OFFSETS_MINUTES` (default `180,120,60,30`). Adding a rung is
an env change and nothing else.

- Only rides at status **`assigned`** are swept. A driver who already tapped
  *on my way* is at `arriving` and needs no reminder.
- **After downtime, exactly one reminder fires.** A trip 50 minutes out is
  technically "due" for the 180, 120 and 60 rungs at once; the sweeper sends only
  the tightest one (`60`) and silently burns the wider ones it slept past. The
  driver gets one accurate *"Trip in 1 hour"*, not a burst of stale ones.
- Each rung is claimed with a Redis `SET NX`, so the job is safe to run in more
  than one replica — unlike the expiry sweeper next door.

---

## Where the code lives

| File | Responsibility |
| --- | --- |
| `src/config/firebase.js` | Admin SDK init; non-fatal when unconfigured |
| `src/services/fcm.service.js` | Transport only: multicast, string coercion, dead-token detection |
| `src/services/notification.service.js` | Recipients → tokens, sending, pruning, device binding |
| `src/notifications/templates.js` | **Every message in one table**, keyed by event then audience |
| `src/notifications/index.js` | `notifyDriver` / `notifyDrivers` / `notifyUser` — mirrors `socket/emitters.js` |
| `src/jobs/outstationReminder.job.js` | The departure ladder |

Adding a push to an existing transition is two steps: add a template entry, then
one line under the socket emit it belongs to.

```js
emitToDriver(driverId, 'bid:accepted', payload);
notifyDriver(driverId, 'bid:accepted', payload);   // ← same shape, on purpose
```

`notify*` is **synchronous and fire-and-forget**, exactly like the emitters.
Callers have already committed their database write; Firebase's latency and
Firebase's outages must never sit on the critical path of accepting a bid. An
event with no template for that audience is a silent no-op.

---

## Known limitation — first-time KYC

`kyc.verified` / `kyc.rejected` are sent from the Signzy callback. On a driver's
**first** KYC there is usually no `fcmToken` yet — the account is created by that
very callback, and the app has not authenticated — so the send resolves to zero
tokens and is skipped. The push lands on re-verification and retries. The app's
existing poll of `GET /drivers/kyc/status/:phonenumber` remains the primary
signal for the first attempt.
