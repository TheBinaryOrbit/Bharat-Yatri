# Driver KYC — Frontend Guide

How the driver app verifies a driver's Aadhaar. KYC happens **after onboarding**, from the
**home screen**, and the driver picks one of two methods:

| Method | How it works | Result |
| --- | --- | --- |
| **DigiLocker** | Signzy DigiLocker in a WebView, Aadhaar OTP | Instant: `verified` or `rejected` |
| **Manual** | Driver uploads photos of the Aadhaar **front** and **back** | `pending` until an admin approves or rejects |

Related: [Driver Login & Onboarding](./driver-auth-onboarding.md)

- **Base URL:** `http://localhost:5000/api/v3` (dev)
- Every app call below needs the driver token: `Authorization: Bearer <token>`

---

## Order of screens

```
OTP verify ──► onboarding (personal → licence → vehicle) ──► Home ──► KYC prompt
```

1. `POST /auth/verify` creates the driver account on first login and **always returns a token**.
   - `userStatus: 404` → onboarding not finished → onboarding screens, resume at `onboarding.nextStep`
   - `userStatus: 200` → onboarding finished → Home
2. On Home, show the KYC card until `kyc.isVerified` is `true`.
3. A driver cannot go online until KYC is verified (the socket `driver:online` refuses).

---

## The `kyc` object

Returned by `POST /auth/verify`, `GET /drivers/onboard/status`, the final onboarding step,
`GET /drivers/kyc/status`, and the KYC submit calls.

```json
{
  "status": "pending",
  "method": "manual",
  "isVerified": false,
  "canSubmit": true,
  "failedReason": "",
  "manual": {
    "aadhaarFrontImageUrl": "http://.../uploads/aadhaarFrontImage-...jpg",
    "aadhaarBackImageUrl": "http://.../uploads/aadhaarBackImage-...jpg",
    "submittedAt": "2026-10-27T10:00:00.000Z"
  }
}
```

| `status` | Home card shows | Actions |
| --- | --- | --- |
| `not_started` | "Complete your KYC" | **Verify with DigiLocker** / **Upload Aadhaar photos** |
| `pending` | "Your Aadhaar is under review" | Optional: re-upload photos, or use DigiLocker instead |
| `rejected` | "KYC failed: `failedReason`" | Both options again |
| `verified` | "Verified ✅" | None — hide the card |

`method` is `"digilocker"`, `"manual"` or `null`. `manual` is only set when `method` is `"manual"`.

---

## Option A — DigiLocker

**`POST /drivers/kyc/digilocker`** · empty body (the old path `/drivers/kyc/verify` still works)

```json
{ "redirectUrl": "https://signzy.../digilocker/session/abc123" }
```

Open `redirectUrl` in an in-app WebView. When Signzy redirects to the success/failure URL,
close the WebView and **poll `GET /drivers/kyc/status`** for ~15 seconds — the result arrives
server-to-server and can lag the redirect. Don't decide success from which URL was hit.

## Option B — Manual (Aadhaar photos)

**`POST /drivers/kyc/manual`** · `multipart/form-data`

| File field | Required |
| --- | --- |
| `aadhaarFrontImage` | ✅ |
| `aadhaarBackImage` | ✅ |

jpeg / jpg / png / webp, max 5 MB each.

```json
{ "message": "Aadhaar submitted. We will verify it shortly.", "kyc": { "status": "pending", "method": "manual", "...": "..." } }
```

The driver gets a push (`kyc.verified` / `kyc.rejected`) when an admin decides. Also refresh
`GET /drivers/kyc/status` when Home opens.

## Status

**`GET /drivers/kyc/status`** → `{ "kyc": { ... }, "onboarding": { ... } }`

---

## Errors

| Status | When | Body |
| --- | --- | --- |
| `409` | Onboarding not finished | `{ "message": "Complete onboarding before starting KYC", "onboarding": {...} }` |
| `409` | Already verified | `{ "message": "KYC is already verified", "kyc": {...} }` |
| `400` | Manual: a photo missing | `{ "message": "Both sides of the Aadhaar card are required", "errors": [{ "field": "aadhaarBackImage", ... }] }` |
| `502` / `500` | DigiLocker provider down | `{ "error": "..." }` — offer the manual option |

---

## Admin (manual review)

Both need the `x-admin-key` header.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `GET` | `/drivers/kyc/manual?status=pending` | — | Review queue, oldest first. `status` defaults to `pending` |
| `PATCH` | `/drivers/:id/kyc/review` | `{ "decision": "approve" }` or `{ "decision": "reject", "reason": "Photo is blurry" }` | `reason` required to reject. `409` if nothing is pending |

The rejection `reason` is shown to the driver as `kyc.failedReason` and in the push.

---

## Removed

- `GET /drivers/kyc/status/:phonenumber` — replaced by `GET /drivers/kyc/status` (token). The
  old route handed out a login token to anyone who knew a verified driver's phone number.
- The DigiLocker callback no longer creates driver accounts; accounts are created at OTP verify.
