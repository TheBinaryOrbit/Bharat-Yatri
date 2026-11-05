 Bharat Yaatri Admin Portal
## Product Requirements & Functional Specification

> **Document status:** Working draft — based on the database collections and workflows shared by the product owner  
> **Version:** 0.2  
> **Last updated:** 5 November 2026  
> **Product:** Bharat Yaatri  
> **Purpose:** Define the admin portal's modules, pages, data visibility, actions, operational workflows and reporting requirements before implementation.

---

## 1. How to read this document

This specification separates facts from proposed admin functionality:

- **Existing data** — collections or fields explicitly described by the product owner.
- **Proposed admin functionality** — useful controls and screens inferred from the current product and schema; confirm before implementation.
- **To verify** — details that require the actual Mongoose schemas, API routes, or business rules.

The collection list and database screenshot show collection names, approximate document counts and index sizes. They do **not** reveal every field, relationship, status value or API capability. The admin portal must use the actual backend schema and validated APIs rather than assuming fields that have not yet been confirmed.

## 2. Product overview

Bharat Yaatri supports two ride journeys:

1. **Quick Ride** — a customer books a quick ride and drivers can participate through the quick-ride bidding workflow.
2. **Outstation Ride** — a customer creates an outstation trip and drivers submit bids through the outstation bidding workflow.

The platform also has customer accounts, driver profiles and KYC/document information, driver vehicles, vehicle categories/types, driver reviews, dynamic app content, app/platform settings, quick destinations, and driver-app install-referrer information.

The admin portal should give authorized staff a central place to operate and configure this ecosystem.

## 3. Database inventory supplied

The following collection names were shared. Approximate document counts below are read from the database screenshot and may change over time.

| Collection | Approx. documents shown | Purpose described |
|---|---:|---|
| `appcontents` | 8 | Dynamic HTML pages such as Terms & Conditions and Privacy Policy |
| `drivers` | 2.4K | Driver profile, documents and KYC details |
| `installreferrers` | 5.2K | Install-referrer information for the driver app |
| `outstationridebids` | 6 | Bids submitted for outstation rides |
| `outstationrides` | 60 | Outstation ride bookings |
| `paymentdetails` | 1.4K | Payment-related records; exact fields and payment flow to verify |
| `quickdestinations` | 389 | Users' saved/quick destinations |
| `quickridebids` | 46 | Bids submitted for quick rides |
| `quickrides` | 1.2K | Quick ride bookings |
| `reviews` | 10 | Reviews for drivers |
| `settings` | 2 | App/platform settings, with separate iOS and Android records |
| `users` | 1.9K | Customer/user accounts |
| `vehicles` | 1.2K | Vehicles belonging to drivers |
| `vehicletypes` | 6 | Vehicle types/categories and admin-managed pricing |

**Important:** `paymentdetails` is present in the database inventory even though its structure was not described in detail. It should be included in discovery and the admin information architecture, but its financial actions must not be finalized until the payment model and schema are reviewed.

---

## 4. Proposed admin portal navigation

This is the proposed information architecture to discuss and approve.

### Overview
- Dashboard
- Live Operations Map
- Driver Heatmap

### Ride Operations
- All Quick Rides
- All Outstation Rides
- Quick Ride Bids
- Outstation Ride Bids
- Ride Details / Activity Timeline

### People
- Customers
- Drivers
- Driver KYC & Documents
- Vehicles
- Reviews

### Configuration
- Vehicle Types & Pricing
- Quick Destinations
- App Content / Legal Pages
- App Settings
- Promotional Banners

### Payments & Reports
- Payment Records
- Ride Reports
- Driver Reports
- Customer Reports
- City / Area Reports

### Acquisition
- Driver Install Referrers

### Administration
- Admin Users & Roles
- Audit Logs
- Support / Complaints (proposed; confirm whether a support collection or workflow already exists)

---

# 5. Module requirements

## 5.1 Dashboard

**Purpose:** Give administrators an at-a-glance view of marketplace activity and operational health.

### Proposed summary cards
- Total customers
- Total drivers
- Drivers verified / pending KYC / rejected / suspended (only where corresponding statuses exist)
- Total vehicles
- Total Quick Rides
- Total Outstation Rides
- Rides created today
- Ongoing rides
- Completed rides
- Cancelled rides
- Total bids received
- Pending driver KYC reviews

### Proposed charts
- Quick Rides vs Outstation Rides over time
- Ride status distribution
- New customer registrations
- New driver registrations
- Driver KYC review status
- Bids per ride / bid activity over time
- Vehicle-type distribution
- Top pickup and destination areas, if location data supports it

### Filters
- Today / yesterday / last 7 days / last 30 days / custom date range
- Ride type
- City or service area, if available
- Ride status

### Rules
- Every metric must define its exact calculation and source collection.
- Do not label total ride fare/value as platform revenue unless the platform actually receives that money.
- Dashboard counts should respect soft-deletion, test accounts and excluded records according to agreed business rules.

**To verify:** Exact ride status values, timestamp fields, city fields and whether completed/cancelled states are stored consistently in both ride collections.

## 5.2 Live Operations Map

**Purpose:** Let operations staff monitor active rides and driver availability geographically.

### Proposed map layers
- Active/ongoing rides
- Drivers currently online/available
- Drivers assigned to a ride
- Pickup and drop-off points
- Optional driver clusters at low zoom levels

### Proposed map interactions
- Filter by Quick Ride / Outstation Ride
- Filter by ride status
- Filter by vehicle type
- Search by ride ID, driver or customer
- Select a driver marker to open a driver summary
- Select a ride marker to open ride details
- Fit map to active rides or selected driver
- Show last location update time

### Driver/ride side panel
- Driver name and ID
- Driver contact details, subject to permission
- Driver's current/last known location
- Online/availability status, if tracked
- Assigned ride ID and ride type
- Ride status
- Pickup and destination
- Last location update timestamp

### Important privacy and reliability rules
- Show live location only when the app has the required permission and the driver is in an eligible operational state.
- Clearly distinguish **live location** from **last known location**.
- Display the last update timestamp and stale-location warning.
- Restrict location visibility to authorized operational roles.
- Do not imply that a driver is online solely because an old location record exists.
- Define location retention and access logging before launch.

**To verify:** Where live coordinates are stored, how updates arrive (for example, socket events or polling), online/offline rules, location freshness threshold, and whether the admin backend already exposes a live tracking API.

## 5.3 Driver Heatmap

**Purpose:** Show geographic concentrations of drivers to help understand coverage and supply distribution.

### Proposed heatmap modes
- Current available-driver density
- All recently active drivers
- Drivers by vehicle type
- Driver density by time range, if historical location data is retained

### Proposed controls
- Time window
- City / service area
- Vehicle type
- Available / on-trip / offline, if these states exist

### Interpretation
- Heat intensity represents the number or density of eligible drivers in an area.
- Heatmap is an aggregate visualization; individual driver identity should not be exposed by default.
- Include a legend and the time window used to calculate the data.

**To verify:** Whether location history is stored or only the latest driver location is available. A true historical heatmap requires historical location points or pre-aggregated geographic data.

## 5.4 Customer Management — `users`

**Existing data:** A `users` collection exists. The full user schema and account lifecycle were not provided.

### Proposed customer list
- Customer name
- User ID
- Phone number / email, if stored
- Registration date
- Account status, if stored
- Total Quick Rides
- Total Outstation Rides
- Last activity, if available

### Proposed filters and search
- Name / phone / email / user ID
- Registration date
- Account status
- Customers with rides / customers without rides

### Proposed customer detail page
- Profile information
- Account creation and update timestamps
- Ride history across both ride types
- Saved quick destinations
- Reviews or support history, if linked
- Payment records, if linked and permitted
- Account status and admin notes

### Proposed admin actions
- View customer
- Edit permitted profile fields
- Activate / deactivate or suspend account, only if supported by backend rules
- Add an internal note
- Review related rides and payment records

### Safety controls
- Require a reason for suspension or reactivation.
- Confirm destructive or access-restricting actions.
- Record admin identity, timestamp, reason and before/after values in an audit log.
- Do not expose sensitive fields to roles that do not need them.

**To verify:** User schema, authentication model, status values, deletion behavior and whether user records link to both ride collections.

## 5.5 Driver Management — `drivers`

**Existing data:** The `drivers` collection contains driver details, documents and KYC information.

### Proposed driver list
- Driver name
- Driver ID
- Phone number
- Registration date
- KYC status
- Account status
- Vehicle count / primary vehicle
- Total rides
- Last active time, if available

### Proposed filters
- KYC pending / approved / rejected / incomplete (map to actual stored values)
- Active / inactive / suspended (if supported)
- Registration date
- Vehicle type
- City / service area, if available

### Driver detail page sections
1. Personal/profile information
2. Contact information
3. KYC information
4. Uploaded documents
5. Linked vehicles
6. Quick Ride history
7. Outstation Ride history
8. Bid history
9. Reviews and ratings
10. Activity / last-seen information
11. Admin notes and audit history

### Proposed admin actions
- View driver profile
- Review KYC documents
- Approve or reject KYC
- Request document re-upload / correction, if the driver app supports it
- Activate / deactivate / suspend driver, if supported
- View linked vehicles
- View ride and bid history
- Add internal note

### KYC review workflow
1. Driver submits profile and required documents through the driver app.
2. The admin portal shows the driver in a pending-review queue, based on the actual KYC status.
3. Admin opens the driver's KYC profile and checks each required document.
4. Admin approves or rejects the submission.
5. If rejected, admin must select or enter a reason.
6. The backend updates the KYC status and records the reviewer and review timestamp.
7. The driver is informed through the existing notification mechanism, if available.
8. The portal shows the updated status and review history.

### KYC design requirements
- Show each document separately with document type, upload date and review status.
- Support secure document preview.
- Provide zoom/rotate where useful.
- Clearly distinguish missing, pending, approved, rejected and expired documents if those concepts exist.
- Never mark a driver fully KYC-approved merely because one document was approved; define the overall completion rule.
- Make approval/rejection actions permission-controlled and auditable.

**To verify:** Actual KYC fields, document types, status enum values, expiry dates, whether KYC is per-driver or per-document, and the exact rule for considering a driver fully verified.

## 5.6 Vehicle Management — `vehicles`

**Existing data:** The `vehicles` collection stores vehicles belonging to drivers.

### Proposed vehicle list
- Vehicle ID
- Registration number
- Linked driver
- Vehicle type
- Make / model, if stored
- Vehicle verification status, if stored
- Created date

### Proposed vehicle detail
- Vehicle information
- Linked driver profile
- Vehicle type/category
- Uploaded vehicle documents, if stored
- Verification status and history
- Related rides, if available

### Proposed admin actions
- View vehicle
- Edit permitted vehicle details
- Verify / reject vehicle documents, if the backend supports this workflow
- Mark inactive / block from use, if supported
- View linked driver

**To verify:** Vehicle schema, document fields, relationship to `drivers`, and whether vehicle verification is separate from driver KYC.

## 5.7 Vehicle Types & Pricing — `vehicletypes`

**Existing data:** The `vehicletypes` collection contains the vehicle categories available on Bharat Yaatri. Admins can manage vehicle types and their prices. The exact pricing formula and schema have not yet been shared.

### Proposed vehicle-type list
- Vehicle type name
- Icon/image, if stored
- Description, if stored
- Active / inactive status
- Display order
- Pricing configuration summary

### Proposed admin actions
- Create vehicle type
- Edit vehicle type
- Activate / deactivate vehicle type
- Change display order
- Update supported pricing fields
- Preview how the category appears in the app

### Pricing controls — to be confirmed
Potential fields may include:
- Base fare
- Per-kilometre rate
- Minimum fare
- Minimum distance
- Waiting charge
- Extra distance charge
- Outstation rate
- Driver/customer fare rules
- City-specific price overrides

These are examples only; implement only the fields and formulas that the current booking and bidding backend actually uses.

### Pricing safeguards
- Show the current value and proposed new value before saving.
- Validate numeric ranges and required fields.
- Confirm changes before publishing.
- Record who changed pricing, when, and the previous/new values.
- Clarify whether price changes affect only new rides or also existing bookings/bids.
- Consider effective-from dates or versioned pricing if historical fare reproducibility is required.

## 5.8 Quick Ride Management — `quickrides`

**Existing data:** `quickrides` stores Quick Ride bookings.

### Proposed list
- Ride ID
- Customer
- Assigned driver, if assigned
- Vehicle type
- Pickup
- Destination
- Requested / agreed fare, where available
- Ride status
- Created date and relevant lifecycle timestamps

### Proposed filters
- Ride ID / customer / driver
- Date range
- Ride status
- Vehicle type
- City / area, if available

### Ride detail page
- Booking and customer details
- Pickup and destination
- Ride route/map, if route coordinates exist
- Vehicle type
- Fare information
- Linked bids
- Assigned driver
- Ride status and status timeline
- Cancellation details, if applicable
- Linked payment record, if available

### Proposed admin actions
- View ride
- View bid history
- Track ride if active
- Review cancellation details
- Add internal note
- Flag for support/safety review

**Operational restriction:** Do not provide an admin button to arbitrarily complete, cancel or reassign a ride unless the business explicitly approves the workflow and the backend validates it. Such actions can affect passenger and driver safety and payment reconciliation.

## 5.9 Quick Ride Bids — `quickridebids`

**Existing data:** `quickridebids` stores bids associated with Quick Rides.

### Proposed bid view
- Bid ID
- Related ride ID
- Driver
- Offered amount
- Bid status
- Bid created/updated time

### Proposed ride-level bid history
- All bids for the selected ride
- Driver who submitted each bid
- Bid amount
- Bid status
- Bid sequence/time
- Accepted bid and selected driver, if represented in the data

### Proposed analytics
- Average bids per ride
- Rides receiving no bids
- Bid acceptance rate
- Time to first bid
- Time from booking to accepted bid
- Average offered fare, if amounts are consistently stored

**To verify:** Bid schema, bid status values, whether counter-offers exist, and how an accepted bid is linked to the final ride/driver.

## 5.10 Outstation Ride Management — `outstationrides`

**Existing data:** `outstationrides` stores outstation ride bookings.

### Proposed list and detail
Use the same core structure as Quick Rides, with outstation-specific information where present:
- Ride ID
- Customer
- Pickup and destination
- Trip date/time
- Return-trip details, if supported
- Vehicle type
- Distance / route estimate, if stored
- Customer's requested fare
- Final accepted fare
- Assigned driver
- Ride status
- Linked bids
- Payment record, if available

### Proposed filters
- Date range
- Ride status
- Vehicle type
- Driver / customer
- Trip date
- City / service area, if available

**To verify:** Outstation booking fields, scheduling rules, one-way/round-trip support, and the exact ride lifecycle.

## 5.11 Outstation Ride Bids — `outstationridebids`

**Existing data:** `outstationridebids` stores bids associated with outstation rides.

### Proposed functionality
- View all outstation bids
- Filter by ride, driver, date and bid status
- Open the parent ride
- Compare bids for a ride
- See accepted/rejected/withdrawn bids where represented in the schema
- Review bidding timeline

### Proposed analytics
- Average bids per outstation ride
- Outstation rides with no bids
- Bid acceptance rate
- Average bid amount
- Time to first bid
- Bid activity by vehicle type and area, if data supports it

## 5.12 Reviews — `reviews`

**Existing data:** `reviews` stores reviews for drivers.

### Proposed review list
- Review ID
- Driver
- Customer, if linked
- Related ride, if linked
- Rating
- Review text
- Created date

### Proposed filters
- Rating range
- Driver
- Date range
- Review with/without text

### Proposed admin actions
- View review and linked ride
- Flag a review for moderation
- Hide/remove a review only under an approved moderation policy and supported backend action
- Record moderation reason and reviewer

### Proposed analytics
- Average driver rating
- Rating distribution
- Drivers with most reviews
- Low-rating review queue

**To verify:** Rating scale, review ownership, edit/delete rules and whether a review can only be submitted after a completed ride.

## 5.13 Quick Destinations — `quickdestinations`

**Existing data:** `quickdestinations` stores users' quick destinations.

### Proposed list
- Destination ID
- User
- Destination label/name
- Address
- Coordinates, if stored
- Created date

### Proposed functionality
- Search destinations
- Filter by user
- View destination on map
- View linked customer profile

### To discuss
- Are these personal saved destinations, shared popular destinations, or both?
- Should admins only view them, or can admins remove inappropriate/invalid entries?
- Should popular destinations be aggregated for demand analysis?

Do not expose one user's saved destinations to another user or use personal destination history for unrelated purposes.

## 5.14 App Content — `appcontents`

**Existing data:** `appcontents` stores dynamic content pages. Example fields shared:

```js
{
  _id: ObjectId("..."),
  slug: "terms-and-conditions",
  type: "driver/user",
  __v: 0,
  content: "html content",
  createdAt: ISODate("..."),
  iconName: "file-document-outline",
  isActive: true,
  name: "Terms & Conditions",
  updatedAt: ISODate("...")
}
```

### Proposed content-management page
- Content/page name
- Slug
- Audience/type (for example, driver or user)
- Active/inactive status
- Last updated
- Updated by, if audit metadata is implemented

### Proposed admin actions
- Create content page
- Edit page name and HTML content
- Edit slug, with URL/reference validation
- Choose audience/type using the supported enum
- Activate/deactivate page
- Preview rendered content
- Save draft/publish, if a draft workflow is implemented

### Content editor requirements
- Rich-text or HTML editor
- Preview mode
- Validation and sanitization of HTML
- Confirmation before publishing
- Preserve a previous version or revision history if practical
- Warn before changing a slug that may be referenced by the apps

### Initial page types to check
- Terms & Conditions
- Privacy Policy
- Other driver/user informational or legal pages

**To verify:** Whether `type` is exactly a string or supports multiple audiences, allowed `slug` values, HTML sanitization policy, and whether the mobile apps fetch active content dynamically.

## 5.15 App Settings — `settings`

**Existing data:** Separate settings records exist for iOS and Android. Fields shared include:

```js
{
  _id: ObjectId("..."),
  type: "ios", // or "android"
  appVersion: "1.0.0",
  appBuildNumber: 1,
  isUpdateMandatory: false,
  homePageContent: "<h2>Welcome to Bharat Yaatri</h2>...",
  userPromotionalBanners: [ /* banner entries */ ],
  createdAt: ISODate("..."),
  updatedAt: ISODate("..."),
  onboardingBeforeKycUrl: "https://bharatyaatri.com/onboarding",
  onboardingAfterKycUrl: "https://bharatyaatri.com/onboarding",
  permissionGuideUrl: "https://bharatyaatri.com/onboarding",
  supportPhoneNumber: "..."
}
```

### Proposed settings page
Provide separate tabs or clearly separated forms for:
- Android
- iOS

### Fields to manage
- Minimum/current app version field (`appVersion`, according to actual app logic)
- Build number (`appBuildNumber`)
- Mandatory update toggle (`isUpdateMandatory`)
- Home page HTML/content (`homePageContent`)
- User promotional banners (`userPromotionalBanners`)
- Onboarding URL before KYC (`onboardingBeforeKycUrl`)
- Onboarding URL after KYC (`onboardingAfterKycUrl`)
- Permission guide URL (`permissionGuideUrl`)
- Support phone number (`supportPhoneNumber`)

### Banner management — proposed
Depending on the actual banner object structure:
- Add banner
- Edit banner
- Remove banner
- Enable/disable banner
- Change display order
- Preview banner
- Validate image/link fields

### Settings safeguards
- Validate URLs and phone number format.
- Preview HTML and banners before saving.
- Confirm mandatory-update changes.
- Make it clear which platform is being edited.
- Record setting changes in an audit log.
- Confirm whether settings are fetched at app startup or refreshed dynamically.

**To verify:** Full banner object schema, app version comparison logic, whether the setting applies to users or drivers, and whether driver app has a separate settings record or uses the same platform record.

## 5.16 Install Referrers — `installreferrers`

**Existing data:** This collection stores install-referrer information for the driver app.

### Proposed admin/report page
- Referrer/source fields available in the schema
- Driver/app-install association, if present
- Install timestamp
- Campaign/source/medium, if captured
- Platform and app version, if captured

### Proposed reports
- Installs by source/campaign
- Installs over time
- Drivers attributed to a source, if the association exists
- Conversion from install to registration/KYC completion, only if records can be reliably joined

**To verify:** Exact schema, source attribution fields, unique install identifier, driver association and privacy/retention rules.

## 5.17 Payment Records — `paymentdetails`

**Existing data:** The collection exists and the screenshot shows approximately 1.4K documents. Its schema and payment workflow have not yet been described.

### Proposed read-only initial page
- Payment/transaction ID
- Related ride ID
- Customer and driver references, if stored
- Amount
- Payment method
- Payment status
- Gateway/order/payment reference, if applicable
- Created/updated timestamps

### Proposed filters
- Date range
- Payment status
- Payment method
- Ride type
- Ride ID / transaction reference

### Important financial distinction
The portal must distinguish:
- Total value of rides
- Amount actually collected by the platform
- Amount paid directly to a driver
- Platform commission/fees, if any
- Refunds, failed payments and pending reconciliation

Do not assume that Bharat Yaatri receives the full fare. Do not provide manual payment-status editing or refund controls until the gateway flow, verification process and reconciliation rules are confirmed.

**To verify:** Full `paymentdetails` schema, gateway(s), payment collection model, webhook verification, refund process and relationship to ride documents.

## 5.18 Support and Complaints — proposed, schema not yet supplied

No support/ticket collection was included in the inventory provided.

Potential functionality:
- Customer/driver complaint submission
- Ticket ID and category
- Related ride
- Priority
- Assigned admin
- Status and resolution notes
- Conversation/history

**Decision required:** Is support managed in another system, through phone/WhatsApp, or should a ticket module be added to the backend?

---

# 6. Cross-module workflows

## 6.1 Driver onboarding and KYC

1. Driver registers in the driver app.
2. Driver profile and submitted documents are stored.
3. Admin sees the driver in the KYC review queue.
4. Admin checks each required document.
5. Admin approves or rejects the submission with a reason.
6. Backend stores the decision and review metadata.
7. Driver receives the appropriate status update, if notification support exists.
8. Admin can later review the driver's KYC history.

**Open decision:** Does approval of all mandatory documents automatically activate the driver, or is account activation a separate admin decision?

## 6.2 Vehicle onboarding

1. Driver adds a vehicle.
2. Vehicle is linked to its driver and a vehicle type.
3. If vehicle documents are required, they are reviewed.
4. Admin approves/rejects the vehicle if that workflow exists.
5. Only eligible vehicles should be selectable for rides, according to the agreed business rules.

## 6.3 Quick Ride lifecycle

The portal should display the actual backend lifecycle, not invent a new one.

Expected visible information:
- Booking created
- Driver bids received
- Bid accepted / driver assigned
- Ride started
- Ride completed
- Ride cancelled, if applicable

**To verify:** Exact status enum and which transitions are controlled by customer, driver or backend.

## 6.4 Outstation Ride lifecycle

Display the actual outstation booking and bidding timeline, including trip scheduling information where supported.

**To verify:** Whether the outstation lifecycle differs from Quick Ride and whether scheduled/return trips have additional states.

## 6.5 Vehicle type and pricing change

1. Admin with pricing permission opens a vehicle type.
2. Portal displays current configuration.
3. Admin edits supported pricing fields.
4. Portal validates values and displays a change summary.
5. Admin confirms.
6. Backend saves the change and audit event.
7. Portal indicates when the change becomes effective.

**Open decision:** Do pricing changes apply immediately, only to newly created rides, or according to a scheduled effective date?

---

# 7. Search, filters, tables and detail pages

All major list pages should use consistent table behavior:

- Server-side pagination for large collections
- Search by relevant identifiers
- Filters appropriate to the module
- Sort by supported fields
- Clear active filters
- Loading, empty and error states
- Detail view accessible from each row
- Export only where approved and permission-controlled

Avoid loading entire collections into the browser. Use indexed backend queries and pagination.

## 8. Admin roles and permissions — proposed

A role-based permission model is recommended.

| Role | Suggested access |
|---|---|
| Super Admin | All modules, role management and critical configuration |
| Operations Admin | Dashboard, live map, rides and operational review |
| KYC Reviewer | Driver KYC and relevant vehicle documents |
| Customer Support | Customer/driver lookup and approved support workflows |
| Finance Admin | Payment records and financial reports |
| Content Manager | App content, banners and app settings |
| Analyst / Read-only | Approved dashboards and reports without mutation access |

Permissions should be assigned per module and action, not only by hiding sidebar links. The backend must enforce authorization for every protected API.

Sensitive actions such as KYC approval, suspension, pricing changes, mandatory app updates and payment adjustments should require explicit permissions and audit logging.

---

# 9. Audit log requirements — proposed

For important admin actions, record:
- Admin ID and role
- Action name
- Target collection/entity and record ID
- Timestamp
- Previous value and new value where appropriate
- Reason/comment for sensitive actions
- Request/correlation ID where available

At minimum, audit:
- Driver KYC decisions
- Driver/customer suspension or activation
- Vehicle verification decisions
- Vehicle type and pricing changes
- App settings changes
- App content publishing
- Admin role/permission changes
- Payment adjustments, if ever supported

Audit logs should be append-only for normal admin users.

---

# 10. Security, privacy and reliability

- Enforce role permissions on the backend.
- Protect KYC documents and personal information.
- Use secure, short-lived document access links where applicable.
- Mask phone numbers and sensitive information for roles that do not need full access.
- Log access to sensitive KYC/location information where practical.
- Validate and sanitize rich HTML content.
- Validate URLs before saving settings.
- Require confirmation for high-impact actions.
- Use server-side pagination and indexed filters.
- Handle stale live-location data explicitly.
- Avoid exposing secrets, tokens or internal credentials in the admin UI.
- Apply rate limiting and session security to admin APIs.
- Keep an audit trail for configuration and account changes.

---

# 11. Reporting and analytics definitions

Before implementing reports, agree on metric definitions.

| Metric | Proposed definition | Needs confirmation |
|---|---|---|
| Total customers | Count of eligible user records | Soft-deleted/test account rules |
| Total drivers | Count of eligible driver records | Excluded/suspended account rules |
| KYC pending | Drivers whose actual KYC status is pending | Actual status values |
| Total Quick Rides | Eligible documents in `quickrides` | Exclusion rules |
| Total Outstation Rides | Eligible documents in `outstationrides` | Exclusion rules |
| Completed rides | Rides with the actual completed status | Status values |
| Cancellation rate | Cancelled rides / eligible created rides | Denominator and exclusions |
| Bid acceptance rate | Accepted bids / eligible bids or rides with bids | Choose and label denominator |
| Average bids per ride | Total eligible bids / rides receiving bids | Treatment of zero-bid rides |
| Driver density | Eligible drivers per map cell/area | Location freshness and status |
| Ride value | Sum of the agreed fare field for eligible rides | Fare field and completed-only rule |
| Platform revenue | Amount retained by Bharat Yaatri | Payment/commission model |

Every chart should show its date range and timezone. Reports should use consistent definitions across dashboard and export.

---

# 12. API and backend integration requirements

The frontend must integrate with existing backend APIs wherever possible. New APIs may be required for admin-specific aggregation, filtering and actions.

Potential API capability groups:
- Authentication and admin profile
- Dashboard metrics
- Live driver locations / live rides
- Customer search and details
- Driver search and details
- KYC queue and document decisions
- Vehicle search and verification
- Quick Ride list/details
- Quick Ride bids
- Outstation Ride list/details
- Outstation Ride bids
- Reviews and moderation
- Vehicle types and pricing
- App content CRUD
- Platform settings
- Quick destinations
- Install-referrer reports
- Payment records and reports
- Admin users, permissions and audit logs

These are capability requirements, not confirmed route names. Actual endpoint paths, request/response formats and authorization rules must be documented from the backend.

---

# 13. Decisions still required

1. Is the admin portal an enhancement of an existing portal or a complete redesign?
2. What are the exact fields and status enums in `users` and `drivers`?
3. What is the full driver KYC document checklist and approval rule?
4. Is vehicle verification separate from driver KYC?
5. What are the exact Quick Ride and Outstation Ride status lifecycles?
6. What are the bid fields and acceptance rules?
7. What is the vehicle pricing formula for each vehicle type?
8. What is the payment collection model and what does `paymentdetails` contain?
9. How is live driver tracking implemented, and where is location data stored?
10. Is historical location data available for heatmaps?
11. What is the full promotional banner object structure?
12. Are settings shared by user and driver apps or separated by app?
13. What admin roles already exist?
14. Is support handled inside Bharat Yaatri or externally?
15. Which reports need CSV/Excel export?

---

# 14. Discovery sequence

We will finalize the portal through these discussions:

1. Existing portal, backend and admin access
2. Dashboard metrics and widgets
3. Live tracking map and driver heatmap
4. Driver management and KYC workflow
5. Customer management
6. Vehicle management and vehicle-type pricing
7. Quick Ride and bidding management
8. Outstation Ride and bidding management
9. Reviews and quick destinations
10. App content and platform settings
11. Payment records and financial reporting
12. Install-referrer analytics
13. Support, safety and fraud workflows
14. Admin roles, permissions and audit logs
15. Final page-by-page UI, API and acceptance criteria

## 15. Current confirmed facts from product-owner discussion

- `appcontents` stores dynamic HTML pages such as Terms & Conditions and Privacy Policy.
- `drivers` stores driver details, documents and KYC information.
- `installreferrers` is for the driver app.
- `outstationrides` and `outstationridebids` represent outstation rides and their bids.
- `quickrides` and `quickridebids` represent Quick Rides and their bids.
- `quickdestinations` stores users' quick destinations.
- `reviews` stores driver reviews.
- `settings` contains platform-specific iOS and Android settings, including app version/build, mandatory update, home page content, promotional banners, onboarding URLs, permission guide URL and support phone number.
- `users` stores user/customer records.
- `vehicles` stores driver vehicles.
- `vehicletypes` stores available vehicle categories and admin-managed pricing.
- The product needs live driver tracking and a driver heatmap in the admin portal.
- Admin functionality should include customer and driver management, driver KYC review/completion, vehicle-type management, settings management and related operational controls.

---

## 16. First discussion to continue

**Recommended starting point: Driver Management & KYC.**

The driver collection is central to supply-side operations and contains documents/KYC information. Before finalizing its screen and workflow, share the actual driver document fields or a sample driver document with personal details masked.

We should establish:
- Which documents are required?
- Is KYC approved per document and also at an overall driver level?
- What statuses exist?
- Can an admin request re-upload?
- Does KYC approval automatically make a driver active?
- Can a driver have multiple vehicles?

Once these are agreed, the driver list, KYC queue, driver profile and approval workflow can be specified precisely.
"""