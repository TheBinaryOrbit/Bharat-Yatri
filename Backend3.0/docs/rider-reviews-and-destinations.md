# Driver Reviews, Saved Destinations & Recent Searches — Rider App Guide

Three small rider-side modules that hang off the existing ride flows:

1. **Reviews** — a rider rates a driver 1–5 with an optional comment, and every bid the rider
   sees now carries that driver's card (name, rating, ten latest reviews, vehicle photo).
2. **Quick destinations** — saved shortcuts ("Home", "Office") for one-tap booking.
3. **Recent destinations** — drop locations inferred from the rider's own ride history, for the
   search bar's suggestion list.

Related: [QuickRide](./driver-quick-ride.md) · [Outstation Rides](./driver-outstation-ride.md)

- **Base URL:** `http://localhost:5000/api/v3` (dev)
- Every call below needs a **user** token unless noted: `Authorization: Bearer <token>`

---

## 1. Reviews

### The driver card on a bid

Nothing to call — this is already inside every bid payload the rider receives. Each bid now has a
`driver` block alongside the fields it always had:

```jsonc
{
  "_id": "...",
  "fare": 240,
  "requestedBy": { "_id": "...", "name": "Ravi Kumar", "phoneNumber": "...", "profileImageUrl": "..." },
  "vehicleId": { "vehicleNumber": "KA01AB1234", "vehicleImages": ["..."], "vehicleTypeId": { ... } },

  "driver": {
    "driverId": "64b7...",
    "name": "Ravi Kumar",
    "profileImageUrl": "https://.../ravi.jpg",
    "vehicleImageUrl": "https://.../car-front.jpg",   // first vehicle image, flattened
    "averageRating": 4.3,                              // null when never rated — NOT 0
    "totalReviews": 27,
    "recentReviews": [                                 // up to 10, newest first
      {
        "_id": "...",
        "rating": 5,
        "comment": "Very smooth drive",
        "createdAt": "2026-07-30T09:14:02.113Z",
        "userId": { "_id": "...", "name": "Anita", "profileImageUrl": "..." }
      }
    ]
  }
}
```

`averageRating` is `null` for a driver nobody has rated yet — render "New driver", not "0 ★".

It rides along on **every** path a bid reaches the rider:

| Where | Kind |
| --- | --- |
| `bid:new` / `outstation:bid_new` | socket push |
| `GET /quick-rides/:id/bids` · `GET /outstation-rides/:id/bids` | REST |
| `GET /quick-rides/live` · `GET /outstation-rides/live` | REST (resume-on-open) |
| the `bid` in the accept response | REST |

### `POST /reviews` — rate a driver

One review per rider per driver, so posting again **edits** the existing one. There is no PATCH.

```jsonc
// body
{ "driverId": "64b7...", "rating": 5, "comment": "Very smooth drive" }   // comment optional, ≤500 chars
```

- `201` — first review · `200` — an edit of an existing one
- `400` — `rating` must be a **whole** number 1–5
- `403` — the rider has not completed a ride with this driver (either product) yet
- `404` — no such driver

### `GET /reviews/driver/:driverId` — the full list

Works with a **user or driver** token, so a driver reads it to see their own rating.

`?limit=` (default 20, max 100) · `?skip=` for paging.

```jsonc
{
  "driver": {
    "driverId": "64b7...", "name": "Ravi Kumar",
    "profileImageUrl": "...", "vehicleImageUrl": "...",
    "averageRating": 4.3, "totalReviews": 27
  },
  "count": 20, "skip": 0, "limit": 20,
  "data": [ /* reviews, newest first, reviewer populated */ ]
}
```

### `GET /reviews/my` — reviews this rider has written

Driver populated on each, so the app can show "you rated them 4★" on a driver you meet again.

### `DELETE /reviews/:id`

Only the author's own. Someone else's review answers `404`, not `403`.

---

## 2. Quick destinations (saved shortcuts)

Rider-only CRUD. Coordinates go in and come out as `{ latitude, longitude }` — the same shape a
ride booking takes — so a shortcut can be dropped straight into `POST /quick-rides`.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/quick-destinations` | `{ tag, dropLocationName, dropCoordinates }` |
| `GET` | `/quick-destinations` | the rider's list, newest first |
| `GET` | `/quick-destinations/:id` | |
| `PATCH` | `/quick-destinations/:id` | partial — any of the three fields |
| `DELETE` | `/quick-destinations/:id` | |

```jsonc
// POST body
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

- `409` — the tag is already used by this rider (tags are unique per rider, **case-sensitive**:
  "Home" and "home" are two different tags), or the rider is at the 20-shortcut ceiling
- `404` — another rider's shortcut, deliberately indistinguishable from one that does not exist

---

## 3. Recent destinations (search suggestions)

### `GET /quick-destinations/recent`

Drop locations from the rider's own booking history, for the search bar. `?limit=` (default 5,
max 20).

```jsonc
{
  "count": 5,
  "data": [
    {
      "dropLocationName": "Kempegowda International Airport",
      "dropCoordinates": { "latitude": 13.1986, "longitude": 77.7066 },
      "rideType": "quickride",              // or "outstation"
      "lastBookedAt": "2026-07-31T18:22:10.004Z"
    }
  ]
}
```

Both ride products are merged and then de-duplicated by name, case- and whitespace-insensitively —
a rider who books the same commute daily sees it once, followed by four other places. Every ride
status counts: where a rider *tried* to go is still a suggestion, even if that ride was cancelled
or found no driver.

It shares the `/quick-destinations` prefix but is not a saved shortcut — these are inferred, those
are chosen. A search bar typically shows the saved list first and these underneath.
