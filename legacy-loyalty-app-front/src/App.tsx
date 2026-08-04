import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ItemsProvider } from './contexts/ItemsContext';
import { AddressProvider } from './contexts/AddressContext';
import {  AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Shop from './components/User/Shop';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ProductPage from './components/User/ProductPage';
import CheckoutPage from './components/User/CheckoutPage'
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminItemsDashboard from './components/Admin/AdminItemsDashboard';
import AdminOrdersDashboard from './components/Admin/AdminOrdersDashboard';
import AdminBillsDashboard from './components/Admin/AdminBillsDashboard';
import SuperAdminDashboard from './components/SuperAdmin/SuperAdminDashboard';
import SuperAdminSystemDashboard from './components/SuperAdmin/SuperAdminSystemDashboard';
import ProfilePage from './components/User/ProfilePage';
import Cart from './components/User/Cart';
import ThankYou from './components/User/ThankYou';
import Help from './components/User/Help';
import BuyNow from './components/User/BuyNow';
import TierPage from './components/User/TierPage';
import ResetPassword from './components/Auth/ResetPassword';
import './App.css';

// The default landing route for each role, used to bounce users who try to
// open a page outside their role.
function homeForRole(userType: string | null): string {
  switch (userType) {
    case 'admin': return '/admin-dashboard';
    case 'superadmin': return '/superadmin-dashboard';
    case 'customer': return '/user/shop';
    default: return '/';
  }
}

// Client-side role guard. NOTE: this is defense-in-depth and UX only — the
// authoritative role enforcement lives in the backend authMiddleware. A user
// editing localStorage can bypass this, but every guarded API call still fails
// server-side.
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactElement }) {
  const { auth } = useAuth();
  if (!auth.userType || !roles.includes(auth.userType)) {
    return <Navigate to={homeForRole(auth.userType)} replace />;
  }
  return children;
}

const CUSTOMER = ['customer'];
const ADMIN = ['admin'];
const SUPERADMIN = ['superadmin'];

function ProtectedRoutes() {
  const { auth } = useAuth();
  return (
      <ItemsProvider>
          <AddressProvider>
              <Routes>
                  <Route path="/user/shop" element={<RequireRole roles={CUSTOMER}><Shop /></RequireRole>} />
                  <Route path="/user/profile" element={<RequireRole roles={CUSTOMER}><ProfilePage /></RequireRole>} />
                  <Route path="/user/cart" element={<RequireRole roles={CUSTOMER}><Cart /></RequireRole>} />
                  <Route path="/product/:id" element={<RequireRole roles={CUSTOMER}><ProductPage /></RequireRole>} />
                  <Route path="/checkout" element={<RequireRole roles={CUSTOMER}><CheckoutPage /></RequireRole>} />
                  <Route path="/buy-now" element={<RequireRole roles={CUSTOMER}><BuyNow /></RequireRole>} />
                  <Route path="/thank-you" element={<RequireRole roles={CUSTOMER}><ThankYou /></RequireRole>} />
                  <Route path="/help" element={<RequireRole roles={CUSTOMER}><Help /></RequireRole>} />
                  <Route path="/tier-page" element={<RequireRole roles={CUSTOMER}><TierPage /></RequireRole>} />
                  <Route path="/admin-dashboard" element={<RequireRole roles={ADMIN}><AdminDashboard /></RequireRole>} />
                  <Route path="/admin-items" element={<RequireRole roles={ADMIN}><AdminItemsDashboard /></RequireRole>} />
                  <Route path="/admin-orders" element={<RequireRole roles={ADMIN}><AdminOrdersDashboard /></RequireRole>} />
                  <Route path="/admin-bills" element={<RequireRole roles={ADMIN}><AdminBillsDashboard /></RequireRole>} />
                  <Route path="/superadmin-dashboard" element={<RequireRole roles={SUPERADMIN}><SuperAdminDashboard /></RequireRole>} />
                  <Route path="/superadmin-items" element={<RequireRole roles={SUPERADMIN}><AdminItemsDashboard /></RequireRole>} />
                  <Route path="/superadmin-orders" element={<RequireRole roles={SUPERADMIN}><AdminOrdersDashboard /></RequireRole>} />
                  <Route path="/superadmin-bills" element={<RequireRole roles={SUPERADMIN}><AdminBillsDashboard /></RequireRole>} />
                  <Route path="/superadmin-system" element={<RequireRole roles={SUPERADMIN}><SuperAdminSystemDashboard /></RequireRole>} />
                  {/* Any authenticated user may reach their own password reset. */}
                  <Route path="/reset-password" element={<ResetPassword />} />
                  {/* Unknown paths bounce to the user's role home instead of a blank page. */}
                  <Route path="*" element={<Navigate to={homeForRole(auth.userType)} replace />} />
              </Routes>
          </AddressProvider>
      </ItemsProvider>
  );
}

function App() {
  const { auth } = useAuth();
  return (
    <div className="App">
        <Header />
        <main className="main-content">
            <Routes>
                <Route path="/" element={<Login />} />
                {auth.isAuthenticated
                    ? <Route path="/*" element={<ProtectedRoutes />} />
                    : <Route path="*" element={<Navigate to="/" replace />} />}
            </Routes>
        </main>
        <Footer />
    </div>
  );
}

export default function RootApp() {
  return (
      <AuthProvider>
          <App />
      </AuthProvider>
  );
}