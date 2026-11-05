import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout, RequirePerm } from './layout/AdminLayout.jsx';
import Login from './pages/Login.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const LiveMap = lazy(() => import('./pages/LiveMap.jsx'));
const Heatmap = lazy(() => import('./pages/Heatmap.jsx'));
const Rides = lazy(() => import('./pages/Rides.jsx'));
const RideDetail = lazy(() => import('./pages/RideDetail.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const Drivers = lazy(() => import('./pages/Drivers.jsx'));
const DriverDetail = lazy(() => import('./pages/DriverDetail.jsx'));
const KycQueue = lazy(() => import('./pages/KycQueue.jsx'));
const KycReview = lazy(() => import('./pages/KycReview.jsx'));
const Vehicles = lazy(() => import('./pages/Vehicles.jsx'));
const VehicleDetail = lazy(() => import('./pages/VehicleDetail.jsx'));
const VehicleTypes = lazy(() => import('./pages/VehicleTypes.jsx'));
const AppContent = lazy(() => import('./pages/AppContent.jsx'));
const AppContentEditor = lazy(() => import('./pages/AppContentEditor.jsx'));
const AppSettings = lazy(() => import('./pages/AppSettings.jsx'));
const Banners = lazy(() => import('./pages/Banners.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const InstallReferrers = lazy(() => import('./pages/InstallReferrers.jsx'));
const AdminUsers = lazy(() => import('./pages/AdminUsers.jsx'));
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const guard = (perm, el) => <RequirePerm perm={perm}>{el}</RequirePerm>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AdminLayout />}>
        <Route index element={guard('dashboard.view', <Dashboard />)} />
        <Route path="live" element={guard('live.view', <LiveMap />)} />
        <Route path="heatmap" element={guard('live.view', <Heatmap />)} />
        <Route path="quick-rides" element={guard('rides.view', <Rides kind="quickride" />)} />
        <Route path="quick-rides/:id" element={guard('rides.view', <RideDetail kind="quickride" />)} />
        <Route path="outstation-rides" element={guard('rides.view', <Rides kind="outstation" />)} />
        <Route path="outstation-rides/:id" element={guard('rides.view', <RideDetail kind="outstation" />)} />
        <Route path="customers" element={guard('people.view', <Customers />)} />
        <Route path="customers/:id" element={guard('people.view', <CustomerDetail />)} />
        <Route path="drivers" element={guard('people.view', <Drivers />)} />
        <Route path="drivers/:id" element={guard('people.view', <DriverDetail />)} />
        <Route path="kyc" element={guard('kyc.review', <KycQueue />)} />
        <Route path="kyc/:id" element={guard('kyc.review', <KycReview />)} />
        <Route path="vehicles" element={guard('people.view', <Vehicles />)} />
        <Route path="vehicles/:id" element={guard('people.view', <VehicleDetail />)} />
        <Route path="vehicle-types" element={guard('pricing.edit', <VehicleTypes />)} />
        <Route path="app-content" element={guard('content.edit', <AppContent />)} />
        <Route path="app-content/new" element={guard('content.edit', <AppContentEditor />)} />
        <Route path="app-content/:id" element={guard('content.edit', <AppContentEditor />)} />
        <Route path="settings" element={guard('settings.edit', <AppSettings />)} />
        <Route path="banners" element={guard('settings.edit', <Banners />)} />
        <Route path="reports" element={guard('reports.view', <Reports />)} />
        <Route path="install-referrers" element={guard('referrers.view', <InstallReferrers />)} />
        <Route path="admins" element={guard('admins.manage', <AdminUsers />)} />
        <Route path="audit-log" element={guard('audit.view', <AuditLog />)} />
        <Route path="account/password" element={<ChangePassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
