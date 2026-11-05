import {
  LayoutDashboard, Map, Flame, Zap, Route, Users, IdCard, ShieldCheck, Car, CarFront, FileText, SlidersHorizontal,
  GalleryHorizontal, BarChart3, Download, UserCog, ScrollText,
} from 'lucide-react';

// Sidebar groups (admin.md §4, minus the standalone Bids / Reviews / Destinations / Payments pages:
// those live inside ride, driver and customer detail). `perm` hides a link; the API still enforces.
export const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', end: true },
      { to: '/live', label: 'Live map', icon: Map, perm: 'live.view', badge: 'activeRides' },
      { to: '/heatmap', label: 'Heatmap', icon: Flame, perm: 'live.view' },
    ],
  },
  {
    label: 'Rides',
    items: [
      { to: '/quick-rides', label: 'Quick rides', icon: Zap, perm: 'rides.view', badge: 'activeQuickRides' },
      { to: '/outstation-rides', label: 'Outstation rides', icon: Route, perm: 'rides.view', badge: 'activeOutstationRides' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers', icon: Users, perm: 'people.view' },
      { to: '/drivers', label: 'Drivers', icon: IdCard, perm: 'people.view' },
      { to: '/kyc', label: 'KYC review', icon: ShieldCheck, perm: 'kyc.review', badge: 'pendingKyc' },
      { to: '/vehicles', label: 'Vehicles', icon: Car, perm: 'people.view' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/vehicle-types', label: 'Vehicle types & fares', icon: CarFront, perm: 'pricing.edit' },
      { to: '/app-content', label: 'App content', icon: FileText, perm: 'content.edit' },
      { to: '/settings', label: 'App settings', icon: SlidersHorizontal, perm: 'settings.edit' },
      { to: '/banners', label: 'Promo banners', icon: GalleryHorizontal, perm: 'settings.edit' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports.view' },
      { to: '/install-referrers', label: 'Install referrers', icon: Download, perm: 'referrers.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admins', label: 'Admin users', icon: UserCog, perm: 'admins.manage' },
      { to: '/audit-log', label: 'Audit log', icon: ScrollText, perm: 'audit.view' },
    ],
  },
];
