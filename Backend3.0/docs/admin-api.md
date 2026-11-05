# Admin API (`/api/v3/admin`)

The admin portal (`AdminPortal/`) talks only to these routes. They are separate from the rider and
driver APIs: their own login, their own token, and a permission check on every route.

## Signing in

Admins sign in with email and password. There is no sign-up. Create the first super admin from the
command line, running it from `Backend3.0/` so `.env` is found:

```bash
node scripts/create-admin.mjs --email ops@bharatyaatri.com --name "Ops Lead" --password "ChangeMe2026x"
```

Running it again with the same email resets that admin's password, name and role, and signs out
all of its sessions. Super admins create every other admin from **Admin users** in the portal.

| Rule | Value |
|---|---|
| Token | JWT `{ id, role: 'admin', tv }`, signed with `JWT_SECRET`, valid **12 h** |
| Token isolation | `protect` (the app middleware) rejects admin tokens. `adminProtect` rejects user and driver tokens. |
| Sign out everywhere | Changing a password, role or active flag increments `tokenVersion`, which invalidates the admin's existing tokens |
| Login throttle | 8 failed attempts per email + IP within 15 min lock that pair out (counted in Redis) |
| Passwords | 10+ characters, letters and numbers, bcrypt with 12 rounds |
| Last super admin | The last active super admin cannot be demoted or deactivated |

The old `x-admin-key` routes (`/settings`, `/app-content`, `/drivers/kyc/manual`, and so on) still
work for scripts. The portal does not use them.

## Roles

| Role | Permissions |
|---|---|
| `super_admin` | All permissions |
| `operations` | `dashboard.view`, `live.view`, `rides.view`, `people.view`, `people.block`, `pii.view`, `reviews.moderate`, `reports.view`, `notes.write` |
| `kyc_reviewer` | `dashboard.view`, `people.view`, `pii.view`, `kyc.review`, `notes.write` |
| `support` | `dashboard.view`, `rides.view`, `people.view`, `people.edit`, `pii.view`, `notes.write` |
| `finance` | `dashboard.view`, `rides.view`, `people.view`, `pii.view`, `reports.view`, `reports.export` |
| `content` | `dashboard.view`, `content.edit`, `settings.edit` |
| `analyst` | `dashboard.view`, `live.view`, `rides.view`, `people.view`, `reports.view`, `referrers.view` |

The role-to-permission map lives in `src/constants/admin.constants.js`.

Callers without `pii.view` get masked values: phone numbers show as `98•••••210`, and Aadhaar
numbers, UPI ids and emails are masked too. Responses never include FCM tokens, the Aadhaar JPEG
from DigiLocker, ride start OTPs, or tracking tokens.

## Blocking accounts

Customers and drivers have four new fields: `isBlocked`, `blockedReason`, `blockedAt` and
`blockedBy`. A blocked account is refused in all three places it can authenticate. Each refusal
returns `403 { error, code: 'ACCOUNT_BLOCKED', reason }`.

| Where | How it refuses |
|---|---|
| OTP login (`/auth/verify`) | 403 before a token is issued |
| Every protected route (`protect`) | 403 |
| Socket connect | Connection refused with `ACCOUNT_BLOCKED` |

Blocking also closes the account's open sockets. For a driver it also removes them from the
dispatch index in Redis.

Blocking does **not** cancel a ride that is already in progress. The portal warns the admin about
this before confirming. Every block and unblock needs a reason, and the reason goes into the audit
log.

## Routes

Lists are paginated with `?page=&limit=` (`limit` is at most 100) and return
`{ data, total, page, limit, pages }`. Date filters accept `from`/`to` (or `date`) as `YYYY-MM-DD`
in IST, the same as the rest of the API. Validation errors come back as
`400 { message, errors: [{ field, message }] }`.

| Route | Permission | Notes |
|---|---|---|
| `POST auth/login` | public | `{ email, password }` returns `{ token, admin }` |
| `GET auth/me` · `PATCH auth/password` | signed in | Changing the password returns a fresh token |
| `GET dashboard/summary` · `dashboard/timeseries` | `dashboard.view` | Defaults to the last 30 days |
| `GET badges` | signed in | Counts shown in the sidebar |
| `GET live/drivers` · `live/rides` | `live.view` | Read from Redis plus active rides. Each driver has `state`: `available`, `on_trip` or `disconnected`, plus `isStale` and `ageSeconds` |
| `GET heatmap/supply` · `heatmap/demand` | `live.view` | Grid cells with counts, no identities. Supply uses current positions only, because no location history is stored. Demand uses ride pickup points |
| `GET quick-rides[/:id]` · `outstation-rides[/:id]` | `rides.view` | The detail response includes every bid, the timeline, the live driver position and the review |
| `GET customers[/:id]` | `people.view` | The detail response includes saved quick destinations and the reviews the customer wrote |
| `PATCH customers/:id` | `people.edit` | Editable fields: `name`, `title`, `sosContact` |
| `PATCH customers/:id/block` · `drivers/:id/block` | `people.block` | `{ blocked, reason }` |
| `GET drivers[/:id]`, `drivers/:id/reviews`, `drivers/:id/bids` | `people.view` | The list includes the average rating. The detail includes UPI payment details and the rating distribution |
| `DELETE drivers/:id/reviews/:reviewId` | `reviews.moderate` | `{ reason }`. The deleted review is kept in the audit log |
| `GET kyc[/:id]` · `PATCH kyc/:id/review` | `kyc.review` | `{ decision: 'approve' \| 'reject', reason }`. One-shot: returns 409 if the driver is no longer pending. Notifies the driver |
| `GET vehicles[/:id]` | `people.view` | `?insurance=expired\|expiring` |
| `GET vehicle-types` | signed in | Includes inactive types |
| `POST vehicle-types` · `PATCH vehicle-types/:id` · `POST vehicle-types/fare-preview` | `pricing.edit` | Multipart, with an optional PNG `icon`. The slug cannot be changed. Price changes are audited before and after |
| `GET/POST/PATCH/DELETE app-content[/:id]` | `content.edit` | HTML is sanitised with `sanitize-html` |
| `GET settings` · `PATCH settings/:type` | `settings.edit` | Validates URLs, the phone number and banners. The first save creates the record |
| `POST uploads/image` | `settings.edit` or `content.edit` | Multipart `image`. Returns `{ url }` |
| `GET reports/rides\|drivers\|customers\|areas` | `reports.view` | Add `?format=csv` to download; this needs `reports.export` |
| `GET install-referrers[/summary\|/timeseries]` | `referrers.view` | The list uses `limit`/`skip`, the same as the original endpoint |
| `GET notes` · `POST notes` | `people.view` / `notes.write` | Internal notes on a user, driver, vehicle or ride |
| `GET/POST/PATCH admins` · `GET admins/roles` | `admins.manage` | |
| `GET audit-logs` | `audit.view` | Read-only. No route updates or deletes audit entries |

## Metric definitions

| Metric | Definition |
|---|---|
| Ride value | Sum of `finalFare` on **completed** rides. This is what riders agreed to pay. It is **not** platform revenue: no commission model exists in the data. |
| Ongoing | Quick ride status `assigned` or `in_progress`; outstation status `assigned`, `arriving` or `in_progress` |
| Completion / cancellation / no-driver rate | Rides completed, cancelled or expired, divided by rides created in the window |
| Minutes to accept | Time from the ride's `createdAt` to the accepted bid's `updatedAt` |
| Bids | QuickRide bids are hard-deleted 60 s after they are placed unless accepted. Bid counts on finished quick rides therefore usually show only the winning bid. |
| Area | The locality read from the Google address text: the third comma-separated part from the end. This is approximate. |
| Days | IST calendar days (`APP_UTC_OFFSET_MINUTES`) |

## Audit log

The `auditlogs` collection is append-only. Each entry records `adminId`, `adminName`, `adminRole`,
`action`, `entity`, `entityId`, `before`, `after`, `reason` and `ip`. Entries are written for:

- KYC decisions
- Blocking and unblocking accounts
- Customer edits
- Review removals
- Vehicle type and pricing changes
- Settings changes, with mandatory-update switches flagged separately
- App content create, update and delete
- Admin user changes
- Password changes
- Notes
