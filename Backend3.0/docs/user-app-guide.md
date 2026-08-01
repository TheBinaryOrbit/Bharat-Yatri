# Bharat Yatri — User (Rider) App Frontend Guide

Everything the rider app calls, in the order it calls it: from the first OTP screen to a finished
ride sitting in history.

Related: [Driver QuickRide](./driver-quick-ride.md) · [Driver Outstation](./driver-outstation-ride.md) ·
[Reviews & Saved Destinations](./rider-reviews-and-destinations.md)

- **Base URL:** `http://localhost:5000/api/v3` (dev)
- **Socket URL:** `http://localhost:5000`
- **Try it:** [`/test`](http://localhost:5000/test) (QuickRide) · [`/test/outstation`](http://localhost:5000/test/outstation) — rider-side browser consoles

---

## Contents

| # | Section |
| --- | --- |
| 0 | [Conventions — auth, error shapes, status codes](#0-conventions) |
| 1 | [Login & account creation](#1-login--account-creation) |
| 2 | [Person info (profile)](#2-person-info-profile) |
| 3 | [Support pages](#3-support-pages) |
| 4 | [Quick destinations (CRUD)](#4-quick-destinations-crud) |
| 5 | [Socket connection](#5-socket-connection) |
| 6 | [QuickRide — the whole module](#6-quickride--the-whole-module) |
| 7 | [Outstation rides — the whole module](#7-outstation-rides--the-whole-module) |
| 8 | [Live tracking](#8-live-tracking) |
| 9 | [History](#9-history) |
| A | [Appendix — status & event reference](#appendix-a--ride-statuses) |

---

## 0. Conventions

### Auth header

Every protected call takes the JWT from login:

```
Authorization: Bearer <token>
```

The token encodes `{ id, role }`. **The server always takes "who you are" from the token, never
from a request body** — never send `userId`, `bookedBy` or `cancelledBy`; they are ignored.

### Response envelopes

There are three shapes. Match on them rather than guessing per endpoint.

```jsonc
// A list
{ "count": 3, "data": [ ... ] }

// A single thing, usually named
{ "message": "Ride created successfully.", "ride": { ... } }

// An error
{ "message": "Human sentence you can show the user", "errors": [ { "field": "...", "message": "..." } ] }
```

`errors[]` is present only on **validation** failures (400) and lists **every** problem in one
pass — render them against the fields, don't just show the first. Other failures carry `message`
alone, sometimes with extra context fields (`bidBounds`, `rideId`, `reason`, `attemptsRemaining`).

Some older endpoints return `{ "error": "..." }` instead of `{ "message": "..." }` — auth failures
and 500s in particular. **Read `message ?? error` everywhere.**

### Status codes

| Code | Means | What the app should do |
| --- | --- | --- |
| `400` | Validation — bad or missing input | Show field errors; don't retry unchanged |
| `401` | No token / bad token / account deleted | Drop the token, go to login |
| `403` | Authenticated but not yours | Go back; refresh the list |
| `404` | Not found, or deliberately hidden from you | Go back; refresh |
| `409` | State conflict — the world moved | **Refetch and re-render.** This is not an error to blame the user for |
| `423` | Ride locked (too many wrong OTPs) | Cancel and rebook |
| `503` | OTP provider down | "Try again in a moment" |
| `500` | Server fault | Generic retry |

`409` is the one to design for. It means something legitimately changed between the rider seeing
the screen and tapping: a bid expired, a driver got taken, the ride timed out. Always follow a 409
with a refetch of the relevant `/live` endpoint.

### Coordinates

The API speaks `{ latitude, longitude }` in and out on every rider-facing field:

```jsonc
{ "pickupCoordinates": { "latitude": 12.9716, "longitude": 77.5946 } }
```

> ⚠️ The **one exception**: a full `ride` object returned by create/update/bid endpoints carries
> raw GeoJSON — `{ "type": "Point", "coordinates": [77.5946, 12.9716] }`, **`[longitude, latitude]`,
> reversed**. Endpoints built for maps (`/track/:token`, `/quick-destinations`) always convert for
> you. Write one helper and run every ride object through it.

### Times

All timestamps are ISO 8601 UTC. Bare `YYYY-MM-DD` filters and `HH:mm` pickup times are read as
**IST** (`APP_UTC_OFFSET_MINUTES`, default +330), so "today" means the rider's today.

---

## 1. Login & account creation

One flow for both — the app cannot know whether the number is registered until the OTP is verified.

```
[Phone entry]
   │  POST /auth/otp   { phoneNumber }
   ▼
[OTP entry]  ← keep the sessionId from the response
   │  POST /auth/verify   { phoneNumber, otp, sessionId, role: 'user', fcmToken }
   ▼
   ├── userStatus 200 ──► token + user  ──────────────────────────► [Home]
   │
   └── userStatus 404 ──► [Registration form]
                             │  POST /users   (multipart)
                             ▼
                          ⚠️ NO TOKEN IS RETURNED — repeat the OTP flow
                             │  POST /auth/otp  →  POST /auth/verify
                             ▼
                          userStatus 200 → token ──────────────────► [Home]
```

### `POST /auth/otp`

```jsonc
// request
{ "phoneNumber": "9876543210" }

// 200
{ "message": "OTP sent successfully.", "sessionId": "6f9c...-session" }
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "error": "Phone number is required." }` | empty `phoneNumber` |
| `503` | `{ "error": "Failed to send OTP. Service unavailable." }` | SMS provider down — offer retry |
| `500` | `{ "error": "Internal Server Error" }` | |

**Hold on to `sessionId`** — verify fails without it.

### `POST /auth/verify`

```jsonc
// request
{
  "phoneNumber": "9876543210",
  "otp": "123456",
  "sessionId": "6f9c...-session",   // from the step above
  "role": "user",                    // MUST be "user" for the rider app
  "fcmToken": "..."                  // optional, persisted for push
}
```

Two different 200 responses — **branch on `userStatus`, not on the HTTP code**:

```jsonc
// 200 — registered
{
  "message": "OTP verified successfully.",
  "userStatus": 200,
  "token": "eyJhbGciOi...",
  "role": "user",
  "user": { "_id": "...", "name": "Anita", "phoneNumber": "9876543210", "profileImageUrl": "", "title": "Ms" }
}

// 200 — OTP was right, but there is no account yet
{ "message": "OTP verified successfully, but account not found.", "userStatus": 404 }
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "All fields are required", "errors": [...] }` | missing `phoneNumber` / `otp` / `sessionId` / `role` |
| `400` | `{ "message": "Role must be one of: 'user', 'driver'" }` | bad `role` |
| `400` | `{ "error": "Invalid or expired OTP." }` | wrong or stale OTP — let them retry, or resend |
| `500` | `{ "error": "Internal Server Error" }` | |

### `POST /users` — create the account

`multipart/form-data`, because of the optional profile picture.

| Field | Required | Notes |
| --- | --- | --- |
| `name` | ✅ | |
| `phoneNumber` | ✅ | the verified number |
| `title` | ✖ | "Mr" / "Ms" / … |
| `profileImage` | ✖ | image **file** — the server stores it and returns `profileImageUrl` |

```jsonc
// 201 — the created user (no envelope, no token)
{ "_id": "...", "title": "Ms", "name": "Anita", "phoneNumber": "9876543210", "profileImageUrl": "http://.../uploads/x.jpg", "fcmToken": "", "createdAt": "...", "updatedAt": "..." }
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "All fields are required", "errors": [...] }` | missing `name` or `phoneNumber` |
| `409` | `{ "message": "Phone number already registered" }` | send them back to login instead |
| `500` | | |

> ⚠️ **Registration does not log you in.** There is no `token` in the 201. The app must re-run
> `POST /auth/otp` → `POST /auth/verify` after registering, which costs the rider a second SMS.
> Worth raising with the backend as a follow-up; until then, build the double-OTP hop into the
> signup screen so it isn't a surprise.

---

## 2. Person info (profile)

### `GET /users/me` — protected, user only

The rider's own record. Call it on every cold start to refresh cached profile data, and treat a
`401` here as "token expired, go to login".

```jsonc
// 200 — the user object DIRECTLY, not wrapped
{ "_id": "...", "title": "Ms", "name": "Anita", "phoneNumber": "9876543210", "profileImageUrl": "...", "fcmToken": "...", "createdAt": "...", "updatedAt": "..." }
```

| Code | Body |
| --- | --- |
| `401` | `{ "error": "Not authorized, no token" }` · `{ "error": "Not authorized, token failed" }` · `{ "error": "Not authorized, account not found" }` |
| `403` | `{ "error": "Forbidden: insufficient permissions" }` — a driver token was used |

Other endpoints exist (`GET /users`, `GET /users/:id`) but they are unauthenticated
admin-era leftovers. **The rider app should only ever use `/users/me`.**

> ⚠️ **There is no profile-update endpoint.** No `PATCH /users/:id`. An "Edit profile" screen
> cannot be built against this API today — the only field the rider can change indirectly is
> `fcmToken`, by sending it on `POST /auth/verify`. Flag this to the backend before designing
> the screen.

---

## 3. Support pages

Server-driven content — terms, privacy, FAQ, about, help. Each item carries a `name`, an
`iconName` for the list row, and a `content` field of **HTML** to render in a webview.

**Public — no token needed.** `:type` is always `user` for this app.

### `GET /app-content/user` — the support menu

```jsonc
// 200 — note: NO `content` field
{
  "count": 4,
  "data": [
    { "_id": "...", "slug": "about-us",             "name": "About Us",           "iconName": "information-outline",   "type": "user", "isActive": true, ... },
    { "_id": "...", "slug": "help-and-support",     "name": "Help & Support",     "iconName": "help-circle-outline",   "type": "user", "isActive": true, ... },
    { "_id": "...", "slug": "privacy-policy",       "name": "Privacy Policy",     "iconName": "shield-lock-outline",   "type": "user", "isActive": true, ... },
    { "_id": "...", "slug": "terms-and-conditions", "name": "Terms & Conditions", "iconName": "file-document-outline", "type": "user", "isActive": true, ... }
  ]
}
```

Those four are what is seeded today. `iconName` is a
[Material Community Icons](https://pictogrammers.com/library/mdi/) name — feed it straight to your
icon component.

Build the menu rows from `name` + `iconName`. **The HTML body is deliberately stripped from the
list** — fetch it from the detail endpoint when the rider taps a row. That keeps the menu call
small no matter how long the terms get.

Already sorted alphabetically by `name`, and already filtered to `isActive: true` — no client-side
filtering or sorting needed.

### `GET /app-content/user/:idOrSlug` — one page

`:idOrSlug` takes either the `_id` or the stable `slug` — e.g.
`GET /app-content/user/terms-and-conditions`. Prefer the slug; it lets you deep-link a
"Privacy Policy" row from anywhere without knowing ids.

```jsonc
// 200 — the item directly, WITH the HTML body
{ "_id": "...", "slug": "terms-and-conditions", "name": "Terms & Conditions",
  "iconName": "file-document-outline", "type": "user", "content": "<h1>Terms…</h1>", "isActive": true, ... }
```

Render `content` in a webview. It is raw HTML authored by an admin — style it with your own
stylesheet rather than expecting it to carry one.

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "App type must be 'user' or 'driver'" }` | `:type` was something else |
| `404` | `{ "message": "App content not found" }` | unknown slug/id, or it belongs to the driver app |

> Unlike the list, this endpoint does **not** filter on `isActive` — a deactivated page is still
> readable by direct slug. Don't deep-link to a page that wasn't in the menu.

---

## 4. Quick destinations (CRUD)

Saved shortcuts — "Home", "Office" — for one-tap booking. **Rider token required on all five.**
Coordinates go in and come out as `{ latitude, longitude }`, the same shape the booking endpoints
take, so a shortcut drops straight into a ride request.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/quick-destinations` | save one |
| `GET` | `/quick-destinations` | the rider's list, newest first |
| `GET` | `/quick-destinations/recent` | **not a shortcut** — recent drops from ride history |
| `GET` | `/quick-destinations/:id` | one |
| `PATCH` | `/quick-destinations/:id` | partial edit |
| `DELETE` | `/quick-destinations/:id` | |

### `POST /quick-destinations`

```jsonc
// request — all three required
{
  "tag": "Home",
  "dropLocationName": "MG Road, Bengaluru",
  "dropCoordinates": { "latitude": 12.9716, "longitude": 77.5946 }
}

// 201
{
  "message": "Destination saved successfully.",
  "destination": {
    "_id": "...", "tag": "Home",
    "dropLocationName": "MG Road, Bengaluru",
    "dropCoordinates": { "latitude": 12.9716, "longitude": 77.5946 },
    "createdAt": "...", "updatedAt": "..."
  }
}
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "All fields are required", "errors": [...] }` | missing `tag` / `dropLocationName`, or bad coordinates |
| `409` | `{ "message": "You already have a destination tagged \"Home\"", "errors": [{ "field": "tag", ... }] }` | tags are unique per rider |
| `409` | `{ "message": "You can save up to 20 destinations. Delete one to add another." }` | at the ceiling |

Tags are **case-sensitive**: "Home" and "home" are two different tags. If you want them to collide,
normalise in the app before sending. Tag max length 30.

### `GET /quick-destinations`

```jsonc
{ "count": 2, "data": [ { "_id": "...", "tag": "Home", "dropLocationName": "...", "dropCoordinates": { ... } } ] }
```

### `GET /quick-destinations/recent` — search suggestions

Drop locations from the rider's **own booking history**, merged across QuickRide and outstation,
de-duplicated by name. `?limit=` (default 5, max 20).

```jsonc
{
  "count": 5,
  "data": [
    {
      "dropLocationName": "Kempegowda International Airport",
      "dropCoordinates": { "latitude": 13.1986, "longitude": 77.7066 },
      "rideType": "quickride",
      "lastBookedAt": "2026-07-31T18:22:10.004Z"
    }
  ]
}
```

Every ride status counts — where a rider *tried* to go is still a suggestion, even if that ride
was cancelled. A typical search bar shows the saved list first, these underneath.

### `PATCH /quick-destinations/:id`

Send any subset of `tag`, `dropLocationName`, `dropCoordinates`.

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "Nothing to update", "errors": [...] }` | empty body |
| `400` | `{ "message": "Invalid destination", "errors": [...] }` | empty tag/name, bad coordinates |
| `404` | `{ "message": "Destination not found" }` | unknown id **or another rider's** |
| `409` | tag clash | |

### `DELETE /quick-destinations/:id`

`200 { "message": "Destination deleted successfully." }` · `404` as above.

> Another rider's shortcut always answers `404`, never `403` — the API will not confirm that
> someone else's record exists. Same for reviews and rides.

---

## 5. Socket connection

The rider app needs one socket for the entire session. Connect right after login and keep it open;
everything live — bids arriving, a driver being assigned, the car moving on the map — comes through
it. REST is the fallback, not the primary path.

### Connecting

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token },                 // the SAME JWT as the Authorization header
  transports: ['websocket'],
});

socket.on('connect_error', (err) => {
  // "Unauthorized: ..." → token is dead, send them to login
  console.error(err.message);
});
```

On connect the server puts the socket in a room keyed to the rider's identity (`user:<id>`), so:

- **Multi-device works.** Two phones logged into the same account both get every event.
- **Reconnects are free.** No re-registration, no state to resend.
- If the rider has a live ride, the server **auto-rejoins its tracking room** and emits
  `ride:rejoined` — you do not have to ask.

Riders **never** emit `driver:*` events. The only two events a rider sends are `ride:join` and
`ride:leave`, and even those are usually unnecessary (see [§8](#8-live-tracking)).

### Events the rider receives — QuickRide

| Event | Payload | What it means |
| --- | --- | --- |
| `bid:new` | `{ quickRideId, bid }` | A driver bid. `bid` carries the full driver card — see [§6.4](#64-bids-arrive) |
| `bid:removed` | `{ bidId, quickRideId }` | Withdrawn, re-bid lower, or the driver got busy. **Drop the row** |
| `bid:expired` | `{ bidId, quickRideId }` | The 60s clock ran out. Drop the row |
| `ride:assigned` | `{ rideId, ride, startOtp, trackingUrl, finalFare }` | Your accept landed. Show the OTP screen |
| `ride:started` | `{ rideId, startedAt }` | Driver entered the OTP; you're moving |
| `ride:completed` | `{ rideId, completedAt, finalFare }` | Trip done → payment / review screen |
| `ride:cancelled` | `{ rideId, cancelledBy, cancellationReason }` | `cancelledBy` is `'user'` or `'driver'` |
| `ride:expired` | `{ rideId }` | 5 minutes passed with no accepted bid |
| `ride:no_drivers` | `{ rideId, searchedRadiusKm }` | Nobody was online in range. The ride is **still live** — offer "raise fare" |
| `ride:location` | `{ rideId, latitude, longitude, heading, speed, at }` | Driver position, ~every 5s |
| `ride:ended` | `{ rideId, reason }` | The tracking room closed. `reason`: `completed` \| `cancelled` \| `expired` |
| `ride:rejoined` | `{ rideId, rideType, rideStatus }` | Auto-rejoined on connect — restore that screen |
| `ride:join_error` | `{ rideId, message }` | A manual `ride:join` was refused |

### Events the rider receives — Outstation

Same shapes, different names. **They do not overlap — register both sets.**

| QuickRide | Outstation |
| --- | --- |
| `bid:new` | `outstation:bid_new` — payload key is `outstationRideId` |
| `bid:removed` | `outstation:bid_removed` |
| `bid:expired` | *(none — outstation bids never expire)* |
| `ride:assigned` | `outstation:assigned` — adds `pickupAt`, `trackingUrl` is `null` |
| — | `outstation:started` — `{ rideId, arrivingAt, trackingUrl }` driver set off |
| `ride:started` | `outstation:picked_up` — `{ rideId, startedAt }` you're aboard |
| `ride:completed` | `outstation:completed` |
| `ride:cancelled` | `outstation:ride_cancelled` |
| `ride:expired` | `outstation:ride_expired` |
| `ride:no_drivers` | `outstation:no_drivers` |

`ride:location`, `ride:ended`, `ride:rejoined` and `ride:join_error` are **shared** — they carry a
`rideId` and are ride-type agnostic. Use `ride:rejoined`'s `rideType` field to tell them apart.

### Reconnect checklist

A socket that drops loses nothing, but the app may have missed events while it was down. On every
`connect`:

1. Call `GET /quick-rides/live` **and** `GET /outstation-rides/live`.
2. Rebuild the screen from those responses — they are designed to answer "where was I?" in one
   round trip each.
3. Let `ride:rejoined` restore the tracking room; do not call `ride:join` speculatively.

---

## 6. QuickRide — the whole module

Trips **up to 100 km**. The rider names a price, drivers bid against it for 5 minutes, the rider
picks one.

```
[Search / pick pickup + drop]
   │  POST /quick-rides/fare-estimate
   ▼
[Vehicle type + fare screen]         ← one card per vehicle type, each with its own band
   │  POST /quick-rides
   ▼
[Searching…]  ⏱ 5 minutes            ← the ride expires unless a bid is accepted
   │   ◄── socket 'bid:new'          (a driver bid — 60s life each)
   │   ◄── socket 'bid:removed' / 'bid:expired'
   │   ◄── socket 'ride:no_drivers'  (nobody in range — offer to raise the fare)
   │
   │   PATCH /quick-rides/:id/fare   raise the offer, attract more drivers
   │   DELETE /quick-ride-bids/:id   dismiss a bid you don't want
   │   PATCH  /quick-ride-bids/:id/accept   ◄── pick one
   ▼
[Driver assigned]  ← startOtp + trackingUrl
   │   ◄── socket 'ride:location' every ~5s
   │   read the OTP out to the driver
   ▼
[In progress]   ◄── socket 'ride:started'
   ▼
[Completed]     ◄── socket 'ride:completed'  → payment + review
```

At any point before the trip starts: `PATCH /quick-rides/:id/cancel`.

### 6.1 Fare estimate

`POST /quick-rides/fare-estimate` — protected, user only.

```jsonc
// request
{
  "pickupCoordinates": { "latitude": 12.9716, "longitude": 77.5946 },
  "dropCoordinates":   { "latitude": 12.9352, "longitude": 77.6245 }
}

// 200
{
  "estimatedDistanceKm": 8.4,
  "estimatedDurationMin": 24,
  "fareOptions": [
    {
      "vehicleType": {
        "_id": "...", "slug": "bharat_mini", "name": "Bharat Mini",
        "description": "...", "capacity": 4, "icon": "http://.../mini.png",
        "features": ["AC Available"], "baseFare": 30, "ratePerKm": 12, "ratePerMinute": 1, "isActive": true
      },
      "suggestedFare": 165,
      "offerBounds": { "min": 132, "max": 248 }
    }
  ]
}
```

Render one card per `fareOptions[]` entry. **`offerBounds` is the slider range** for that card —
the rider may nudge the fare between `min` and `max`, and nothing outside it will be accepted.

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "Pickup and drop coordinates are required", "errors": [...] }` | missing/invalid coords |
| `400` | `{ "message": "QuickRide is available for trips up to 100 km. This trip is 143 km." }` | **route them to outstation booking** |
| `400` | `{ "message": "<route error>" }` | no drivable route between the two points |
| `404` | `{ "message": "No vehicle types are available right now" }` | nothing configured server-side |

### 6.2 Book the ride

`POST /quick-rides` — protected, user only.

```jsonc
// request
{
  "pickupLocationName": "Indiranagar Metro",
  "dropLocationName": "MG Road, Bengaluru",
  "pickupCoordinates": { "latitude": 12.9784, "longitude": 77.6408 },
  "dropCoordinates":   { "latitude": 12.9716, "longitude": 77.5946 },
  "vehicleTypeId": "bharat_mini",   // ObjectId OR slug — both work
  "offeredFare": 180                 // OPTIONAL — omit to use suggestedFare
}

// 201
{
  "ride": {
    "_id": "...", "rideStatus": "searching",
    "suggestedFare": 165, "offeredFare": 180,
    "estimatedDistanceKm": 8.4, "estimatedDurationMin": 24,
    "expiresAt": "2026-08-01T10:35:00.000Z",     // ⏱ start the countdown from this
    "pickupCoordinates": { "type": "Point", "coordinates": [77.6408, 12.9784] },   // ⚠️ GeoJSON, [lng, lat]
    ...
  },
  "offerBounds": { "min": 132, "max": 248 },
  "bidBounds":   { "min": 144, "max": 270 }
}
```

The fare is **recomputed server-side** — the estimate response is not trusted. Send the rider's
chosen value and handle the band error if it's stale.

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "All fields are required", "errors": [...] }` | missing names / vehicle type / coords |
| `400` | `{ "message": "Your fare must be between 132 and 248 for this trip", "suggestedFare": 165, "offerBounds": {...}, "errors": [...] }` | `offeredFare` outside the band — **re-render the slider from `offerBounds`** |
| `400` | distance cap | over 100 km |
| `404` | `{ "message": "Vehicle type not found" }` | |
| `409` | `{ "message": "You already have a ride searching for drivers. Cancel it before booking another.", "rideId": "..." }` | **one open hail at a time** — offer "go to that ride" or "cancel it" using the returned `rideId` |

Right after this returns, the server pushes the ride to nearby drivers in the background. If nobody
is online in range you'll get `ride:no_drivers` on the socket within a second or two — the ride is
still alive and still collecting bids, so show a soft "still looking…" state, not a failure.

### 6.3 Countdown & expiry

`ride.expiresAt` is **5 minutes** from creation. When it passes with no accepted bid the server
flips the ride to `expired` and emits `ride:expired`. Drive the UI timer off `expiresAt`, not off a
local 300-second counter — the two drift.

### 6.4 Bids arrive

Each bid pushes over `bid:new` and lives **60 seconds** (`bid.expiresAt`). Sorted cheapest-first
when fetched.

```jsonc
// socket 'bid:new' → { quickRideId, bid }
{
  "_id": "...",
  "fare": 172,
  "requestStatus": "pending",
  "expiresAt": "2026-08-01T10:31:00.000Z",     // ⏱ per-bid countdown
  "quickRideId": "...",
  "requestedBy": { "_id": "...", "name": "Ravi Kumar", "phoneNumber": "...", "profileImageUrl": "..." },
  "vehicleId": {
    "vehicleNumber": "KA01AB1234", "vehicleName": "Swift Dzire",
    "vehicleImages": ["http://.../front.jpg"],
    "vehicleTypeId": { "name": "Bharat Mini", "icon": "...", ... }
  },
  "driver": {                                   // ← the card to render
    "driverId": "...",
    "name": "Ravi Kumar",
    "profileImageUrl": "http://.../ravi.jpg",
    "vehicleImageUrl": "http://.../front.jpg",
    "averageRating": 4.3,                       // null when never rated — show "New driver", NOT 0
    "totalReviews": 27,
    "recentReviews": [
      { "_id": "...", "rating": 5, "comment": "Very smooth drive", "createdAt": "...",
        "userId": { "_id": "...", "name": "Anita", "profileImageUrl": "..." } }
    ]
  }
}
```

**Re-bidding:** a driver may bid again to *undercut themselves*. You'll get `bid:removed` for the
old bid then `bid:new` for the cheaper one — key your list on `bid._id` and this works out.

**Polling fallback:** `GET /quick-rides/:id/bids` → `{ count, data: [...] }`, same objects, sorted
by fare ascending. Errors: `404` ride not found, `403` not your ride.

### 6.5 Raise the fare

`PATCH /quick-rides/:id/fare` — **increase only**. Raising re-pushes the ride to drivers, including
ones who came online after it was booked, and raises the ceiling drivers may bid to.

```jsonc
// request
{ "offeredFare": 200 }

// 200
{ "message": "Fare updated successfully.", "ride": { ... }, "offerBounds": {...}, "bidBounds": {...} }
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "A valid fare is required", "errors": [...] }` | not a positive number |
| `400` | `{ "message": "Fare cannot go above 248 for this trip", "suggestedFare": 165, "offerBounds": {...} }` | above the band's ceiling |
| `400` | `{ "message": "Fare can only be increased. Your current offer is 180." }` | tried to lower it |
| `403` | not your ride | |
| `409` | `{ "message": "This ride is no longer accepting bids" }` | already assigned, cancelled or expired |

### 6.6 Accept a bid

`PATCH /quick-ride-bids/:id/accept` — the single most important call in the app.

```jsonc
// 200
{
  "message": "Bid accepted successfully.",
  "ride": { ...full ride, rideStatus: "assigned"... },
  "bid": { ...the winning bid, with its driver card... },
  "startOtp": "4821",                                    // ⚠️ show this to the rider, prominently
  "trackingUrl": "https://.../track/9f2a...token"        // shareable link
}
```

On success the server, in one shot: assigns the ride, deletes every losing bid, notifies those
drivers, and **puts both parties in the tracking room** — you do not need to call `ride:join`.
`ride:location` events start flowing immediately.

`startOtp` is the rider's to read out loud. It is **never** sent to the driver; the driver types it
in to start the trip.

| Code | Body | What happened & what to do |
| --- | --- | --- |
| `404` | `{ "message": "Bid not found" }` | it expired and was deleted — refresh the list |
| `404` | `{ "message": "Ride not found" }` | |
| `403` | `{ "error": "Forbidden: this ride belongs to another user" }` | |
| `409` | `{ "message": "This bid has expired" }` | the 60s ran out mid-tap — refresh |
| `409` | `{ "message": "This driver is no longer available. Their bid has been removed — please pick another.", "reason": "..." }` | they won another ride first. **The bid is already gone** — refresh and let the rider pick again |
| `409` | `{ "message": "This ride is no longer available" }` | the ride expired, or another device of theirs accepted first |

Every one of those 409s means "refetch `/quick-rides/live` and re-render". Do not show a hard error
dialog — this is normal in a live auction.

### 6.7 Reject / dismiss a bid

`DELETE /quick-ride-bids/:id` — the rider swipes a bid away. **The ride stays open** and that same
driver may bid again at a lower price.

```jsonc
// 200
{ "message": "Bid dismissed successfully." }
```

| Code | Body | Cause |
| --- | --- | --- |
| `404` | `{ "message": "Bid not found" }` | already expired |
| `403` | `{ "error": "Forbidden: this ride belongs to another user" }` | |
| `409` | `{ "message": "An accepted bid cannot be dismissed. Cancel the ride instead." }` | you already accepted it |

### 6.8 Resume — `GET /quick-rides/live`

**The single call on app open / return from background.** Works with either role; for a rider it
returns their in-flight ride and its current bids.

```jsonc
// 200 — nothing live
{ "role": "user", "hasLiveRide": false, "ride": null, "bids": [], "count": 0 }

// 200 — live
{
  "role": "user",
  "hasLiveRide": true,
  "ride": { ... },
  "rideStatus": "assigned",
  "offerBounds": { "min": 132, "max": 248 },
  "bidBounds":   { "min": 144, "max": 270 },
  "startOtp": "4821",        // only when rideStatus === 'assigned', else null
  "trackingUrl": "https://.../track/...",
  "count": 2,
  "bids": [ /* only while 'searching'; each with its driver card */ ]
}
```

Restore the screen straight from `rideStatus`:

| `rideStatus` | Screen |
| --- | --- |
| `searching` | the bid list + countdown from `ride.expiresAt` |
| `assigned` | driver details + `startOtp` + live map |
| `in_progress` | live map, no OTP |
| anything else | no live ride — go home |

### 6.9 Ride detail & cancel

`GET /quick-rides/:id` — participants only. Returns `{ ride }`, plus `trackingUrl` and the OTP
inside `ride` when the caller is the rider and the ride is `assigned`.
Errors: `404` not found, `403` `{ "error": "Forbidden: you are not part of this ride" }`.

`PATCH /quick-rides/:id/cancel` — either party.

```jsonc
// request (reason optional but worth collecting)
{ "cancellationReason": "Waited too long" }

// 200
{ "message": "Ride cancelled successfully.", "ride": { ...rideStatus: "cancelled", cancelledBy: "user"... } }
```

| Code | Body | Cause |
| --- | --- | --- |
| `403` | `{ "error": "Forbidden: you are not part of this ride" }` | |
| `409` | `{ "message": "A ride that is in_progress cannot be cancelled" }` | **once the trip has started it cannot be cancelled** — that's a support case |
| `404` | | |

`cancelledBy` is taken from the token's role — never send it.

### 6.10 Completion

The driver ends the trip. The rider gets `ride:completed` `{ rideId, completedAt, finalFare }` and
`ride:ended` `{ rideId, reason: 'completed' }`. Move to the payment/summary screen using
`finalFare` — this is the **accepted bid's** fare, not the offered one.

Then prompt for a review: `POST /reviews { driverId, rating, comment }` —
see [Reviews](./rider-reviews-and-destinations.md).

---

## 7. Outstation rides — the whole module

Trips of **100 km or more**, bookable now or scheduled up to 30 days ahead. Same auction shape as
QuickRide with five deliberate differences:

| | QuickRide | Outstation |
| --- | --- | --- |
| Distance | ≤ 100 km | ≥ 100 km |
| Ride lifetime | 5 minutes | **24 hours** (or until `pickupAt`, whichever is sooner) |
| Bid lifetime | 60 seconds | **never expires** — no `bid:expired` |
| Concurrent rides | one at a time | **many** — `/live` returns a LIST |
| Driver phases | assigned → in_progress | assigned → **arriving** → in_progress |

### 7.1 Fare estimate

`POST /outstation-rides/fare-estimate` — same body as QuickRide, two extra fields back:

```jsonc
// 200
{
  "estimatedDistanceKm": 143.2,
  "estimatedDurationMin": 186,
  "fareOptions": [ { "vehicleType": {...}, "suggestedFare": 2450, "offerBounds": { "min": 1960, "max": 3675 } } ],
  "minPickupAt": "2026-08-01T11:30:00.000Z",   // ← bound your date picker with these two
  "maxPickupAt": "2026-08-31T10:30:00.000Z"
}
```

`400 { "message": "Outstation rides are for trips of at least 100 km. This trip is 8 km — book it as a QuickRide." }`
— route them back to QuickRide.

### 7.2 Book

`POST /outstation-rides` — the QuickRide body **plus scheduling**.

```jsonc
// "leave now"
{ ...same fields as QuickRide..., "bookingType": "now" }     // bookingType may be omitted; defaults to "now"

// scheduled — form A: a native date+time picker (recommended)
{ ...same fields..., "bookingType": "later", "pickupDate": "2026-08-05", "pickupTime": "09:30" }

// scheduled — form B: you already hold a real Date
{ ...same fields..., "bookingType": "later", "pickupAt": "2026-08-05T04:00:00.000Z" }
```

`pickupDate` + `pickupTime` are read as **IST wall-clock** — exactly what the rider picked on their
phone. Use form A unless you have a genuine UTC instant; it avoids doing timezone maths in the app.
**Sending both forms is an error.**

```jsonc
// 201
{ "ride": { ..., "bookingType": "later", "pickupAt": "...", "expiresAt": "...", "rideStatus": "searching" },
  "offerBounds": {...}, "bidBounds": {...} }
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "field": "pickupAt", "message": "Send pickupAt as an ISO timestamp, or pickupDate and pickupTime — not both" }` | both forms sent |
| `400` | `{ "field": "pickupAt", "message": "A scheduled ride needs pickupAt (ISO timestamp) or pickupDate (YYYY-MM-DD) and pickupTime (HH:mm)" }` | `later` with no time |
| `400` | `{ "field": "pickupAt", "message": "Pickup must be at least 60 minutes from now" }` | too soon |
| `400` | `{ "field": "pickupAt", "message": "Pickup cannot be more than 30 days ahead" }` | too far |
| `400` | `{ "field": "pickupDate", "message": "pickupDate is not a real date" }` | e.g. `2026-02-31` |
| `400` | `{ "field": "pickupTime", "message": "pickupTime must be HH:mm in 24-hour time" }` | |
| `400` | distance floor / fare band | as above |
| `404` | vehicle type | |

> **There is no "you already have a ride searching" 409 here.** An outstation rider is *planning* —
> next Friday's Delhi trip and next month's Jaipur trip can both sit out for bids. Design the UI
> for a list of open trips, not a single one.

### 7.3 Bids, fare raises, accept, reject

Identical to QuickRide except for the paths, the payload key (`outstationRideId`) and the absence
of any expiry:

| Action | Endpoint |
| --- | --- |
| List bids | `GET /outstation-rides/:id/bids` |
| Raise fare | `PATCH /outstation-rides/:id/fare` |
| Accept | `PATCH /outstation-ride-bids/:id/accept` |
| Dismiss | `DELETE /outstation-ride-bids/:id` |

Bids carry the **same `driver` card**. They have **no `expiresAt`** — do not render a countdown; a
bid placed on a trip three days out is still there that evening.

Accept returns:

```jsonc
{
  "message": "Bid accepted successfully.",
  "ride": { ...rideStatus: "assigned"... },
  "bid": { ... },
  "startOtp": "4821",
  "trackingUrl": null          // ⚠️ ALWAYS null here — see below
}
```

> **`trackingUrl` is `null` on accept, by design.** An outstation trip accepted three days early
> must not stream the driver's location for three days. The link is minted only when the driver
> taps "setting off", and arrives on the `outstation:started` event. Show "tracking available once
> your driver sets off" until then.

Accept errors are the same set as QuickRide's ([§6.6](#66-accept-a-bid)).

### 7.4 The extra phase — `arriving`

```
assigned ──(driver taps "setting off")──► arriving ──(driver enters OTP)──► in_progress ──► completed
             socket 'outstation:started'      socket 'outstation:picked_up'
             + trackingUrl arrives            + tracking window CLOSES
```

`arriving` is **the only window an outstation ride is trackable.** The moment the rider is aboard
the token is destroyed, the room is torn down (`ride:ended` with `reason: 'picked_up'`), and any
share link stops working. Handle `outstation:picked_up` by swapping the live map for a trip-in-
progress screen.

### 7.5 Resume — `GET /outstation-rides/live`

**Plural**, unlike QuickRide's:

```jsonc
{
  "role": "user",
  "hasLiveRides": true,
  "count": 2,
  "rides": [
    {
      "ride": { ... },
      "rideStatus": "searching",
      "offerBounds": {...}, "bidBounds": {...},
      "startOtp": null,                 // set once 'assigned' or 'arriving'
      "trackingUrl": null,              // non-null ONLY while 'arriving'
      "bidCount": 3,
      "bids": [ /* with driver cards */ ]
    }
  ]
}
```

Render as a list of trip cards. Call this alongside `GET /quick-rides/live` on every cold start —
a rider can legitimately have a QuickRide in progress *and* outstation trips out for bids.

### 7.6 Cancel

`PATCH /outstation-rides/:id/cancel` — same contract as QuickRide, and cancellable through
`arriving` as well. Once `in_progress`, `409`.

---

## 8. Live tracking

### When there is something to track

| | Window opens | Window closes |
| --- | --- | --- |
| QuickRide | bid accepted (`assigned`) | ride completed / cancelled / expired |
| Outstation | driver sets off (`arriving`) | rider picked up, or cancelled |

### In-app tracking (the rider is logged in)

Nothing to do. The server puts the rider in the ride room the moment the window opens, so
`ride:location` just starts arriving on the socket you already have:

```js
socket.on('ride:location', ({ rideId, latitude, longitude, heading, speed, at }) => {
  // ~every 5 seconds while the driver's app is pinging
  moveMarker(latitude, longitude, heading);
});

socket.on('ride:ended', ({ rideId, reason }) => {
  // reason: 'completed' | 'cancelled' | 'expired' | 'picked_up'
  teardownMap();
});
```

If you ever need to join manually — a fresh screen mid-trip, a deep link — emit:

```js
socket.emit('ride:join', { rideId, rideType: 'quickride' }, (ack) => {
  if (!ack.ok) console.warn(ack.message);   // 'Ride not found' | 'This ride is no longer active' | 'Not a participant in this ride'
});
```

`rideType` defaults to `'quickride'`; **outstation clients must send `'outstation'`** or the join
resolves against the wrong collection and answers "Ride not found". On a successful join the server
immediately replays the last known position, so the map is never blank.

`socket.emit('ride:leave', { rideId })` when the screen unmounts.

### Share-link tracking (anyone with the URL)

`trackingUrl` from accept / `/live` / `outstation:started` is shareable with someone who has no
account. Two ways to consume it:

**REST** — `GET /quick-rides/track/:token` or `GET /outstation-rides/track/:token`, **public, no token header**:

```jsonc
// 200 — deliberately redacted: no phone numbers, no OTP, no fare, no rider identity
{
  "rideId": "...",
  "rideStatus": "assigned",
  "pickupLocationName": "...", "dropLocationName": "...",
  "pickupCoordinates": { "latitude": 12.9784, "longitude": 77.6408 },
  "dropCoordinates":   { "latitude": 12.9716, "longitude": 77.5946 },
  "estimatedDistanceKm": 8.4, "estimatedDurationMin": 24,
  "driver": { "name": "Ravi", "profileImageUrl": "..." },     // FIRST NAME ONLY
  "vehicle": { "vehicleName": "Swift Dzire", "vehicleNumber": "KA01AB1234", "vehicleType": "Bharat Mini" },
  "lastLocation": { "latitude": 12.98, "longitude": 77.63, "at": 1754043600000 }
}
```

`404 { "message": "This tracking link is no longer valid" }` — an unknown token and an ended ride
are **intentionally indistinguishable**.

**Socket** — connect with the token instead of a JWT for live updates:

```js
const viewer = io('http://localhost:5000', { auth: { trackingToken: token } });
viewer.on('ride:location', updateMap);
viewer.on('ride:ended', showTripFinished);
```

A viewer socket is scoped to that one ride and is strictly read-only.

There is also a ready-made public page at `GET /track/:token` (served by this backend) if you'd
rather not build the share view yourself.

---

## 9. History

Two endpoints, same filter grammar. Both work for either role; a rider token returns rides they
booked.

### `GET /quick-rides/my` · `GET /outstation-rides/my`

| Query | Example | Meaning |
| --- | --- | --- |
| `status` | `?status=completed` or `?status=completed,cancelled` | one or a comma-separated list |
| `date` | `?date=2026-07-30` | a single calendar day (IST) |
| `from` / `to` | `?from=2026-07-01&to=2026-07-30` | inclusive range; either bound works alone |
| `by` | `?by=pickupAt` | **outstation only** — filter and sort by departure instead of booking time |

All optional and combinable. Omitting everything returns the full history, newest first.

```jsonc
// 200
{
  "count": 12,
  "filters": {                       // echoed back — label the list with what you actually got
    "status": ["completed"],
    "by": "createdAt",               // outstation only
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-30T18:29:59.999Z"
  },
  "data": [ /* full ride objects, vehicleType + driver + rider populated, newest first */ ]
}
```

| Code | Body | Cause |
| --- | --- | --- |
| `400` | `{ "message": "Invalid ride filters", "errors": [{ "field": "status", "message": "Unknown status: foo. Allowed: searching, assigned, ..." }] }` | typo'd status — the API refuses rather than silently returning nothing |
| `400` | `{ "field": "date", "message": "Use date for a single day or from/to for a range, not both" }` | |
| `400` | `{ "field": "from", "message": "from must be on or before to" }` | |
| `400` | `{ "field": "by", "message": "by must be createdAt or pickupAt" }` | outstation only |

**`by=pickupAt` is what a scheduled product needs:** a trip booked last month for next Friday
belongs in next Friday's list, not last month's. Use it for an "Upcoming trips" tab
(`?by=pickupAt&status=assigned&from=<today>`), and `createdAt` for "Booking history".

Bare `YYYY-MM-DD` dates are IST calendar days, inclusive on both ends. Send a full ISO timestamp
if you need an exact instant.

**A combined history screen** means calling both endpoints and merging client-side — there is no
unified endpoint. Sort the merged list on `createdAt` and tag each row by which call it came from.

---

## Appendix A — ride statuses

**QuickRide**

| Status | Meaning |
| --- | --- |
| `searching` | out for bids (≤ 5 min) |
| `assigned` | a bid was accepted; driver on the way; OTP live |
| `in_progress` | OTP entered, rider aboard |
| `completed` | finished |
| `cancelled` | deliberate — see `cancelledBy` (`user` \| `driver`) + `cancellationReason` |
| `expired` | auto — nobody accepted in time |

**Outstation** — the same six plus `arriving` between `assigned` and `in_progress`.

Cancellable from `searching` / `assigned` (outstation: also `arriving`). Never from `in_progress`.

---

## Appendix B — call order cheat-sheet

```
App launch
├─ token in storage?
│   ├─ no  → POST /auth/otp → POST /auth/verify → (userStatus 404 → POST /users → verify again)
│   └─ yes → GET /users/me                              (401 → drop token, go to login)
├─ socket.connect({ auth: { token } })
├─ GET /quick-rides/live         ─┐ restore whatever was in flight
├─ GET /outstation-rides/live    ─┘
├─ GET /quick-destinations        saved shortcuts
├─ GET /quick-destinations/recent search suggestions
└─ GET /app-content/user          support menu (cacheable)

Booking
├─ POST /{quick-rides|outstation-rides}/fare-estimate
├─ POST /{quick-rides|outstation-rides}
├─ ◄ socket bids → PATCH /{...}-bids/:id/accept
└─ ◄ socket ride:location → ride:completed → POST /reviews

Anytime
├─ PATCH /{...}/:id/fare      raise the offer
├─ DELETE /{...}-bids/:id     dismiss a bid
├─ PATCH  /{...}/:id/cancel   cancel the ride
└─ GET    /{...}/my           history
```

---

## Appendix C — known gaps

Flag these to the backend before building the affected screens:

1. **No profile update endpoint.** No `PATCH /users/:id` exists — an "Edit profile" screen cannot
   be built today.
2. **Registration returns no token.** `POST /users` gives back the user only, forcing a second
   OTP round-trip (and a second SMS) immediately after signup.
3. **No unified ride history.** QuickRide and outstation history must be fetched separately and
   merged in the app.
4. **`GET /users` and `GET /users/:id` are unauthenticated.** Do not call them from the rider app;
   they should be admin-gated server-side.
