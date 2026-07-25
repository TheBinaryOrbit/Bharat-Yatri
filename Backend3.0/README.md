# Bharat Yatri — Backend v3

Node.js + Express + MongoDB (Mongoose) REST API.

Two account types — **User** and **Driver** — authenticated via phone-number
OTP (2factor.in). All routes are versioned under **`/api/v3`** and follow a
**class-based `Route → Controller → Service`** architecture.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env   # then edit values

# 3. Run in development (auto-reload)
npm run dev

# 3b. Or run in production
npm start
```

Server starts on `http://localhost:5000`. Health check: `GET /health`.

## Environment variables

| Variable           | Description                                  |
| ------------------ | -------------------------------------------- |
| `NODE_ENV`         | `development` \| `production`                |
| `PORT`             | Server port (default `5000`)                 |
| `MONGO_URI`        | MongoDB connection string **(required)**     |
| `JWT_SECRET`       | Secret for signing JWTs **(required)**       |
| `JWT_EXPIRES_IN`   | Token lifetime (default `7d`)                |
| `OTP_KEY`          | 2factor.in API key                           |
| `OTP_DIGIT_LENGTH` | OTP length — `4` or `6` (default `6`)        |

## Folder structure

```
Backend3.0/
├── server.js                   # Entry — connects DB, starts server
├── .env / .env.example         # Config (.env is gitignored)
└── src/
    ├── app.js                  # Express app: middleware + routes at /api/v3
    ├── config/
    │   ├── env.js              # Loads & validates env vars
    │   └── db.js               # MongoDB connection
    ├── routes/
    │   ├── index.js            # Mounts feature routers under /api/v3
    │   ├── auth.routes.js      # OTP send / verify
    │   └── user.routes.js      # User CRUD
    ├── controllers/            # Class-based; services injected in constructor
    │   ├── auth.controller.js
    │   └── user.controller.js
    ├── services/               # Class-based business/DB logic
    │   ├── otp.service.js      # sendOTP / verifyOTP (2factor.in)
    │   ├── user.service.js
    │   └── driver.service.js
    ├── models/                 # Mongoose schemas
    │   ├── user.model.js
    │   └── driver.model.js
    ├── middlewares/
    │   ├── auth.js             # protect (role-aware JWT) + authorize(...roles)
    │   ├── notFound.js         # 404 handler
    │   └── errorHandler.js     # Centralized error handling
    └── utils/
        ├── token.js            # generateToken / verifyToken (JWT)
        ├── asyncHandler.js     # Async error forwarding wrapper
        └── ApiError.js         # Error class with status code
```

## Data models

### User
`title`, `name`, `phoneNumber` (unique), `profileImageUrl`, `fcmToken`, timestamps.

### Driver
`name`, `email` (unique, sparse), `phoneNumber` (unique), `profileImageUrl`,
`dob`, `gender` (`male`/`female`/`other`), `address`, `aadharCardNumber`,
`fcmToken`, timestamps, plus nested:

```
dlDetails: { dlNumber, dlFrontImageUrl, dlBackImageUrl }
```

## Authentication flow (OTP)

Both apps share the same endpoints; the `role` field selects the collection.

| Method | Path                | Body                                              |
| ------ | ------------------- | ------------------------------------------------- |
| POST   | `/api/v3/auth/otp`  | `{ phoneNumber }`                                 |
| POST   | `/api/v3/auth/verify` | `{ phoneNumber, otp, sessionId, fcmToken, role }` |

- `role` is `"user"` or `"driver"`.
- **Send** returns `{ sessionId }` used to verify.
- **Verify** outcomes:
  - Account **found** → `200 { userStatus: 200, token, role, user }`
    (JWT issued, `fcmToken` updated).
  - Account **not found** → `200 { userStatus: 404, message }`
    (OTP matched — frontend routes to registration).
  - Invalid OTP → `400`.

> ⚠️ `OTPService.verifyOTP` contains a **testing bypass** for a hardcoded
> phone number / OTP. Remove or guard it before production.

### Protecting routes

```js
import { protect, authorize } from '../middlewares/auth.js';

router.get('/me', protect, handler);              // any logged-in account
router.post('/trips', protect, authorize('driver'), handler); // drivers only
```

`protect` verifies the JWT, then loads the account from the correct
collection based on the token's `role`, attaching `req.user` and `req.role`.

## Conventions

- All API routes are versioned under `/api/v3`.
- **Class-based** `Route → Controller → Service`:
  - Controllers are classes; dependent services are instantiated in the
    `constructor`. Methods are **arrow functions** so `this` stays bound
    when passed as route handlers.
  - Controllers validate input and shape responses; services hold the
    business/DB logic.
- Route files instantiate the controller once and map routes to methods.

### Adding a new resource (e.g. `address`)

1. `models/address.model.js` — Mongoose schema
2. `services/address.service.js` — `export class AddressService { ... }`
3. `controllers/address.controller.js` — `export class AddressController`,
   instantiate needed services in the constructor
4. `routes/address.routes.js` — `new AddressController()`, map routes
5. Register in `routes/index.js`: `router.use('/addresses', addressRoutes)`

## Example endpoints

| Method | Path                  | Description         |
| ------ | --------------------- | ------------------- |
| GET    | `/health`             | Health check        |
| POST   | `/api/v3/auth/otp`    | Send OTP            |
| POST   | `/api/v3/auth/verify` | Verify OTP → JWT    |
| GET    | `/api/v3/users`       | List users          |
| GET    | `/api/v3/users/:id`   | Get user by id      |
| POST   | `/api/v3/users`       | Create a user       |
