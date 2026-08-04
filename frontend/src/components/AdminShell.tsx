import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

// Admin & superadmin share this desktop layout. Nav items depend on role:
// superadmin additionally manages users and system settings.
export default function AdminShell() {
  const { auth, logout } = useAuth();
  const base = auth.userType === 'superadmin' ? '/superadmin' : '/admin';
  const isSuper = auth.userType === 'superadmin';

  const link = (to: string, label: string) => (
    <NavLink to={to} end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      {label}
    </NavLink>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">SGS</div>
        <div className="admin-role">{isSuper ? 'Superadmin' : 'Admin'}</div>
        {link(base, 'Overview')}
        {link(`${base}/users`, 'Dealers')}
        {link(`${base}/orders`, 'Orders')}
        {link(`${base}/bills`, 'Bills')}
        {link(`${base}/items`, 'Rewards')}
        {isSuper && link(`${base}/tier-review`, 'Tier Review')}
        {isSuper && link(`${base}/system`, 'System')}
        <div className="nav-spacer" />
        <button className="nav-link" onClick={logout} style={{ textAlign: 'left' }}>Log out</button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
