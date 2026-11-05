// Admin portal roles and what each one may do.
//
// Permissions are checked per route on the backend (middlewares/adminAuth.js → can()); the portal
// reads the same list from /admin/auth/me only to decide what to show. Hiding a link is never the
// control — the route is.

export const ADMIN_PERMISSIONS = [
  'dashboard.view',
  'live.view', // live map + heatmap
  'rides.view',
  'people.view', // customers, drivers, vehicles
  'people.edit', // edit customer profile fields
  'people.block', // block / unblock customers and drivers
  'pii.view', // full phone numbers, Aadhaar, UPI; masked otherwise
  'kyc.review',
  'reviews.moderate',
  'pricing.edit', // vehicle types and fares
  'content.edit', // app content pages
  'settings.edit', // app settings + banners
  'reports.view',
  'reports.export',
  'referrers.view',
  'notes.write',
  'admins.manage',
  'audit.view',
];

const ALL = ADMIN_PERMISSIONS;

export const ADMIN_ROLES = {
  super_admin: { label: 'Super Admin', permissions: ALL },
  operations: {
    label: 'Operations Admin',
    permissions: [
      'dashboard.view', 'live.view', 'rides.view', 'people.view', 'people.block', 'pii.view',
      'reviews.moderate', 'reports.view', 'notes.write',
    ],
  },
  kyc_reviewer: {
    label: 'KYC Reviewer',
    permissions: ['dashboard.view', 'people.view', 'pii.view', 'kyc.review', 'notes.write'],
  },
  support: {
    label: 'Customer Support',
    permissions: ['dashboard.view', 'rides.view', 'people.view', 'people.edit', 'pii.view', 'notes.write'],
  },
  finance: {
    label: 'Finance Admin',
    permissions: ['dashboard.view', 'rides.view', 'people.view', 'pii.view', 'reports.view', 'reports.export'],
  },
  content: {
    label: 'Content Manager',
    permissions: ['dashboard.view', 'content.edit', 'settings.edit'],
  },
  analyst: {
    label: 'Analyst (read-only)',
    permissions: ['dashboard.view', 'live.view', 'rides.view', 'people.view', 'reports.view', 'referrers.view'],
  },
};

export const ADMIN_ROLE_KEYS = Object.keys(ADMIN_ROLES);

export const permissionsFor = (role) => ADMIN_ROLES[role]?.permissions ?? [];

// Admin sessions are deliberately shorter than the apps' 7 days.
export const ADMIN_TOKEN_TTL = '12h';

// Login throttle: this many failures per email+IP inside the window locks further attempts.
export const ADMIN_LOGIN_MAX_FAILURES = 8;
export const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60;

export const ADMIN_MIN_PASSWORD_LENGTH = 10;

export const NOTE_ENTITIES = ['user', 'driver', 'vehicle', 'quickride', 'outstation'];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// A live position older than this is shown as "last known", not live.
export const LIVE_STALE_SECONDS = 30;
