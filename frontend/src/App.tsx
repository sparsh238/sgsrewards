import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth, homeForRole, setupRouteFor } from './lib/auth';
import { DealerTierProvider, useDealerTier } from './lib/tierTheme';
import { CartProvider } from './lib/cart';
import { tierStyleVars } from './lib/tier';
import BottomNav from './components/BottomNav';
import QuarterWelcomeGate from './components/QuarterWelcomeGate';
import ProfileGate from './components/ProfileGate';
import AdminShell from './components/AdminShell';
import Login from './screens/Login';
import ResetPassword from './screens/ResetPassword';
import SetPin from './screens/SetPin';
import Home from './screens/Home';
import TierPage from './screens/TierPage';
import Shop from './screens/Shop';
import Product from './screens/Product';
import Cart from './screens/Cart';
import Checkout from './screens/Checkout';
import OrderPlaced from './screens/OrderPlaced';
import ProfilePage from './screens/Profile';
import Overview from './screens/admin/Overview';
import Users from './screens/admin/Users';
import AdminOrders from './screens/admin/Orders';
import Bills from './screens/admin/Bills';
import Items from './screens/admin/Items';
import System from './screens/admin/System';
import TierReview from './screens/admin/TierReview';
import Calendar from './screens/admin/Calendar';
import SalesTeam from './screens/admin/SalesTeam';

// Client-side role guard — UX only; the backend enforces roles authoritatively.
function RequireRole({ roles }: { roles: string[] }) {
  const { auth, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  // Must set their PIN/password before anything else.
  if (!auth.isPasswordReset) return <Navigate to={setupRouteFor(auth.userType)} replace />;
  if (!auth.userType || !roles.includes(auth.userType)) {
    return <Navigate to={homeForRole(auth.userType)} replace />;
  }
  return <Outlet />;
}

/** Phone-width frame for dealer + auth screens. */
function MobileFrame({ children }: { children: React.ReactNode }) {
  return <div className="mobile-frame">{children}</div>;
}

/** Mobile frame carrying the dealer's tier tokens (accent, card, coin, ground). */
function ThemedFrame({ children }: { children: React.ReactNode }) {
  const tier = useDealerTier();
  return (
    <div className="mobile-frame" data-tier={tier ?? undefined} style={tierStyleVars(tier)}>
      {children}
    </div>
  );
}

/** Dealer layout: themed mobile frame + fixed bottom navigation. */
function DealerShell() {
  return (
    <DealerTierProvider>
      <CartProvider>
        <ThemedFrame>
          <Outlet />
          <BottomNav />
          <QuarterWelcomeGate />
          <ProfileGate />
        </ThemedFrame>
      </CartProvider>
    </DealerTierProvider>
  );
}

function LandingRedirect() {
  const { auth, isAuthenticated } = useAuth();
  if (isAuthenticated) {
    if (!auth.isPasswordReset) return <Navigate to={setupRouteFor(auth.userType)} replace />;
    return <Navigate to={homeForRole(auth.userType)} replace />;
  }
  return <MobileFrame><Login /></MobileFrame>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/reset-password" element={<MobileFrame><ResetPassword /></MobileFrame>} />
      <Route path="/set-pin" element={<MobileFrame><SetPin /></MobileFrame>} />

      {/* Dealer app */}
      <Route element={<RequireRole roles={['customer']} />}>
        <Route element={<DealerShell />}>
          <Route path="/home" element={<Home />} />
          <Route path="/tier" element={<TierPage />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-placed" element={<OrderPlaced />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Admin console */}
      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="bills" element={<Bills />} />
          <Route path="items" element={<Items />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>
      </Route>

      {/* Sales console — scoped to the rep's dealers; no Rewards / Tier Review / System */}
      <Route element={<RequireRole roles={['sales']} />}>
        <Route path="/sales" element={<AdminShell />}>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="team" element={<SalesTeam />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="bills" element={<Bills />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>
      </Route>

      {/* Superadmin console (adds Users management + System) */}
      <Route element={<RequireRole roles={['superadmin']} />}>
        <Route path="/superadmin" element={<AdminShell />}>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="bills" element={<Bills />} />
          <Route path="items" element={<Items />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="tier-review" element={<TierReview />} />
          <Route path="system" element={<System />} />
        </Route>
      </Route>

      <Route path="*" element={<LandingRedirect />} />
    </Routes>
  );
}
