import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

// Shared console layout for admin, superadmin and sales. Nav items depend on role:
// sales is scoped and loses Rewards / Tier Review / System; superadmin adds Tier
// Review + System. On narrow screens the sidebar becomes a slide-in drawer.
export default function AdminShell() {
  const { auth, logout } = useAuth();
  const isSuper = auth.userType === 'superadmin';
  const isSales = auth.userType === 'sales';
  const base = isSales ? '/sales' : isSuper ? '/superadmin' : '/admin';
  const roleLabel = isSales ? (auth.salesReadOnly ? 'Sales · view only' : 'Sales') : isSuper ? 'Superadmin' : 'Admin';
  const [navOpen, setNavOpen] = useState(false);

  const link = (to: string, label: string) => (
    <NavLink to={to} end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setNavOpen(false)}>
      {label}
    </NavLink>
  );

  return (
    <div className={`admin-layout${navOpen ? ' nav-open' : ''}`}>
      <div className="admin-topbar">
        <button className="admin-burger" aria-label="Menu" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>☰</button>
        <div className="admin-brand" style={{ padding: 0 }}>SGS</div>
        <div className="admin-role" style={{ padding: 0, marginLeft: 'auto' }}>{roleLabel}</div>
      </div>
      <aside className="admin-sidebar">
        <div className="admin-brand">SGS</div>
        <div className="admin-role">{roleLabel}</div>
        {link(base, 'Overview')}
        {link(`${base}/users`, 'Dealers')}
        {link(`${base}/orders`, 'Orders')}
        {link(`${base}/bills`, 'Bills')}
        {!isSales && link(`${base}/items`, 'Rewards')}
        {link(`${base}/calendar`, 'Calendar')}
        {isSuper && link(`${base}/tier-review`, 'Tier Review')}
        {isSuper && link(`${base}/system`, 'System')}
        <div className="nav-spacer" />
        <button className="nav-link" onClick={logout} style={{ textAlign: 'left' }}>Log out</button>
      </aside>
      {navOpen && <button className="admin-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
