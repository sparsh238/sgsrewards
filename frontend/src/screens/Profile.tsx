import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatNumber } from '../lib/format';
import { TIER_ACCENT, type Bill, type Tier } from '../lib/tier';
import type { Order } from '../lib/types';

interface Profile {
  username: string;
  partyName: string;
  phoneNumber: string;
  gstin?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  availablePoints: number;
  totalPoints: number;
  tier: Tier;
}

interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

type Tab = 'orders' | 'bills';
type OrderStatus = 'All' | 'Pending' | 'Completed' | 'Cancelled';

// ISO date -> yyyy-mm-dd for <input type=date>; '' if empty.
const toInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);

  const [tab, setTab] = useState<Tab>('orders');
  const [status, setStatus] = useState<OrderStatus>('All');
  const [orders, setOrders] = useState<Page<Order> | null>(null);
  const [oPage, setOPage] = useState(1);
  const [bills, setBills] = useState<Page<Bill> | null>(null);
  const [bPage, setBPage] = useState(1);

  // Profile edit
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState('');
  const [anniv, setAnniv] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson<Profile>('/api/user/profile')
      .then((p) => { if (alive) { setProfile(p); setDob(toInput(p.dateOfBirth)); setAnniv(toInput(p.anniversaryDate)); } })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ page: String(oPage), pageSize: '6', status });
    apiJson<Page<Order>>(`/api/user/orders?${q}`).then((r) => { if (alive) setOrders(r); }).catch(() => {});
    return () => { alive = false; };
  }, [oPage, status]);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ page: String(bPage), pageSize: '8' });
    apiJson<Page<Bill>>(`/api/bill/user?${q}`).then((r) => { if (alive) setBills(r); }).catch(() => {});
    return () => { alive = false; };
  }, [bPage]);

  const saveDates = async () => {
    setSaving(true);
    try {
      const updated = await apiJson<Profile>('/api/user/profile', {
        method: 'PUT',
        json: { dateOfBirth: dob || null, anniversaryDate: anniv || null },
      });
      setProfile(updated);
      setEditing(false);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const accent = profile ? TIER_ACCENT[profile.tier] : '#9AA0A8';
  const totalPages = (p: Page<unknown> | null) => (p ? Math.max(1, Math.ceil(p.total / p.pageSize)) : 1);

  const Pager = ({ page, pages, onGo }: { page: number; pages: number; onGo: (n: number) => void }) =>
    pages <= 1 ? null : (
      <div className="pg-pager">
        <button className="pgp" disabled={page <= 1} onClick={() => onGo(page - 1)} aria-label="Previous">‹</button>
        <span className="pgp-cur num">{page} / {pages}</span>
        <button className="pgp" disabled={page >= pages} onClick={() => onGo(page + 1)} aria-label="Next">›</button>
      </div>
    );

  return (
    <div className="page">
      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* Header with always-reachable logout (menu + explicit button below) */}
      <div className="prof-top">
        <span className="prof-title">Profile</span>
        <div className="prof-menu">
          <button className="prof-dots" aria-label="Menu" onClick={() => setMenu((m) => !m)}>⋮</button>
          {menu && (
            <div className="prof-pop" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>✎ Edit profile</button>
              <button role="menuitem" className="danger" onClick={logout}>⏻ Log out</button>
            </div>
          )}
        </div>
      </div>

      {profile ? (
        <div className="profile-head">
          <div className="avatar" aria-hidden="true" style={{ color: accent, borderColor: accent }}>
            {(profile.firstName || profile.partyName || profile.username).charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="party">{profile.partyName}</div>
            <div className="page-sub">{profile.phoneNumber}{profile.gstin ? ` · ${profile.gstin}` : ''}</div>
            <span className="prof-tier" style={{ color: accent, borderColor: accent }}>
              {profile.tier === 'NoTier' ? 'No tier yet' : `◆ ${profile.tier}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="skeleton" style={{ height: 56 }} />
      )}

      {profile && (
        <div className="card" style={{ display: 'flex', gap: 0, padding: '14px 0' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="points-lab">Available</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--copper-hi)' }}>{formatNumber(profile.availablePoints)}</div>
          </div>
          <div style={{ width: 1, background: 'var(--hairline)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="points-lab">Lifetime</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{formatNumber(profile.totalPoints)}</div>
          </div>
        </div>
      )}

      {/* My details — DOB & anniversary editable; name/phone/GST locked */}
      {profile && (
        <div className="card prof-details">
          <div className="prof-drow"><span className="pd-l">Name</span><span className="pd-v">{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}</span></div>
          {editing ? (
            <>
              <div className="prof-drow"><span className="pd-l">Date of birth</span>
                <input className="input pd-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
              <div className="prof-drow"><span className="pd-l">Anniversary</span>
                <input className="input pd-input" type="date" value={anniv} onChange={(e) => setAnniv(e.target.value)} /></div>
              <div className="prof-dedit">
                <button className="btn btn-ghost" onClick={() => { setEditing(false); setDob(toInput(profile.dateOfBirth)); setAnniv(toInput(profile.anniversaryDate)); }}>Cancel</button>
                <button className="btn btn-primary" onClick={saveDates} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="prof-drow"><span className="pd-l">Date of birth</span><span className="pd-v">{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '—'}</span></div>
              <div className="prof-drow"><span className="pd-l">Anniversary</span><span className="pd-v">{profile.anniversaryDate ? formatDate(profile.anniversaryDate) : <span className="pd-add" onClick={() => setEditing(true)}>Add</span>}</span></div>
              <button className="prof-editlink" onClick={() => setEditing(true)}>✎ Edit dates</button>
            </>
          )}
        </div>
      )}

      <div className="seg-row" role="tablist" aria-label="History">
        <button className={`seg${tab === 'orders' ? ' on' : ''}`} role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>Orders</button>
        <button className={`seg${tab === 'bills' ? ' on' : ''}`} role="tab" aria-selected={tab === 'bills'} onClick={() => setTab('bills')}>Bills</button>
      </div>

      {tab === 'orders' && (
        <>
          <div className="chip-row">
            {(['All', 'Pending', 'Completed', 'Cancelled'] as OrderStatus[]).map((s) => (
              <button key={s} className={`fchip${status === s ? ' on' : ''}`} onClick={() => { setStatus(s); setOPage(1); }}>{s}</button>
            ))}
          </div>
          {orders && orders.items.length === 0 ? (
            <div className="empty"><b>No orders</b><span>{status === 'All' ? 'Redeem your first reward from the shop.' : `No ${status.toLowerCase()} orders.`}</span></div>
          ) : (
            (orders?.items ?? []).map((o) => (
              <div key={o._id} className="act-row">
                <span><b className="num">{o.orderIdAlias}</b> · {o.items[0]?.itemId?.name ?? 'items'}{o.items.length > 1 && ` +${o.items.length - 1} more`}
                  <span className="sub">{formatDate(o.orderDate)} · <span className="num">{formatNumber(o.totalValue)} pts</span></span>
                </span>
                <span className={`pill ${o.status.toLowerCase()}`}>{o.status}</span>
              </div>
            ))
          )}
          <Pager page={oPage} pages={totalPages(orders)} onGo={setOPage} />
        </>
      )}

      {tab === 'bills' && (
        <>
          {bills && bills.items.length === 0 ? (
            <div className="empty"><b>No bills yet</b><span>Bills added by SGS will appear here.</span></div>
          ) : (
            (bills?.items ?? []).map((b) => (
              <div key={b._id} className="act-row">
                <span><b className="num">{b.billNumber}</b><span className="sub">{formatDate(b.billDate)} · ₹{formatNumber(b.billAmount)}</span></span>
                <span className="amt-plus num">{b.pointsAwarded ? `+${formatNumber(b.pointsAwarded)}` : '—'}</span>
              </div>
            ))
          )}
          <Pager page={bPage} pages={totalPages(bills)} onGo={setBPage} />
        </>
      )}

      <button className="btn btn-ghost prof-logout" onClick={logout}>⏻ Log out</button>
    </div>
  );
}
