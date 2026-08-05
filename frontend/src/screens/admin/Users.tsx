import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { formatNumber } from '../../lib/format';
import { TIER_ORDER, type Tier } from '../../lib/tier';
import Modal from '../../components/Modal';
import DealerCard from './DealerCard';
import SearchInput from '../../components/SearchInput';
import Chevron from '../../components/Chevron';

interface UserRow {
  _id: string;
  username: string;
  partyName: string;
  phoneNumber: string;
  gstin?: string;
  region?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  profileCompleted?: boolean;
  inScheme?: boolean;
  userType: 'customer' | 'admin' | 'superadmin' | 'sales';
  salesReadOnly?: boolean;
  salesAreas?: string[];
  salesHead?: string;
  availablePoints: number;
  tier: Tier;
  blocked?: boolean;
}

type TierFilter = 'All' | Tier;

export default function Users() {
  const { auth } = useAuth();
  const isSuper = auth.userType === 'superadmin';
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [editFor, setEditFor] = useState<UserRow | null>(null);
  const [tab, setTab] = useState<'dealers' | 'team' | 'sales'>('dealers');
  const [addSalesOpen, setAddSalesOpen] = useState(false);
  const [editSalesFor, setEditSalesFor] = useState<UserRow | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [scheme, setScheme] = useState<'all' | 'active' | 'redeem'>('all');
  const [region, setRegion] = useState<string>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast, toastError } = useToast();

  const listPath = isSuper ? '/api/superadmin/allusers' : '/api/admin/users';
  const load = () => apiJson<UserRow[]>(listPath).then(setUsers).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const patchLocal = (id: string, patch: Partial<UserRow>) =>
    setUsers((list) => list?.map((u) => (u._id === id ? { ...u, ...patch } : u)) ?? null);

  const toggleBlock = async (u: UserRow) => {
    const next = !u.blocked;
    patchLocal(u._id, { blocked: next });
    try {
      await apiJson(`/api/superadmin/users/${u._id}/block`, { method: 'POST', json: { blocked: next } });
      toast(next ? `${u.partyName} blocked` : `${u.partyName} unblocked`);
    } catch (err) { patchLocal(u._id, { blocked: !next }); toastError((err as Error).message); }
  };

  const changeTier = async (u: UserRow, newTier: Tier) => {
    const prev = u.tier;
    patchLocal(u._id, { tier: newTier });
    try {
      await apiJson('/api/superadmin/users/change-tier', { method: 'POST', json: { userId: u._id, newTier } });
      toast(`${u.partyName} → ${newTier}`);
    } catch (err) { patchLocal(u._id, { tier: prev }); toastError((err as Error).message); }
  };

  const dealers = useMemo(() => (users ?? []).filter((u) => u.userType === 'customer'), [users]);
  const staff = useMemo(() => (users ?? []).filter((u) => u.userType === 'admin' || u.userType === 'superadmin'), [users]);
  const salespeople = useMemo(() => (users ?? []).filter((u) => u.userType === 'sales'), [users]);
  const salesHeads = useMemo(() => salespeople.filter((u) => u.salesReadOnly).map((u) => ({ username: u.username, partyName: u.partyName })), [salespeople]);
  const headName = (uname?: string) => salespeople.find((s) => s.username === uname)?.partyName ?? uname;
  const isActive = (u: UserRow) => u.inScheme !== false;
  const regions = useMemo(() => [...new Set(dealers.map((u) => u.region).filter(Boolean) as string[])].sort(), [dealers]);

  // Area is the outer scope; scheme + tier chip counts all reflect the chosen area.
  const inArea = useMemo(() => (region === 'All' ? dealers : dealers.filter((u) => (u.region || '') === region)), [dealers, region]);
  const activeCount = useMemo(() => inArea.filter(isActive).length, [inArea]);
  const redeemCount = inArea.length - activeCount;

  const scoped = useMemo(() => inArea.filter((u) => {
    if (scheme === 'active' && !isActive(u)) return false;
    if (scheme === 'redeem' && isActive(u)) return false;
    return true;
  }), [inArea, scheme]);
  const tierCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of scoped) c[u.tier] = (c[u.tier] ?? 0) + 1;
    return c;
  }, [scoped]);

  const visible = useMemo(() => {
    const base = tab === 'dealers' ? scoped : staff;
    const q = query.trim().toLowerCase();
    return base.filter((u) => {
      if (tab === 'dealers' && tierFilter !== 'All' && u.tier !== tierFilter) return false;
      if (!q) return true;
      return u.partyName.toLowerCase().includes(q)
        || (u.phoneNumber ?? '').includes(q)
        || (u.gstin ?? '').toLowerCase().includes(q)
        || `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q);
    });
  }, [tab, scoped, staff, tierFilter, query]);

  const contactName = (u: UserRow) => [u.firstName, u.lastName].filter(Boolean).join(' ');

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{auth.userType === 'sales' ? 'Dealers' : 'Users'}</h1>
          <p className="page-sub">{auth.userType === 'sales' ? 'Your dealers, scoped to your assigned areas.' : 'Dealer accounts, keyed by phone & GSTIN. Staff live under Team.'}</p>
        </div>
        <div className="admin-toolbar">
          {tab === 'dealers' && regions.length > 0 && (
            <select className="input" style={{ width: 'auto' }} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="All">All areas</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {tab !== 'sales' && <SearchInput value={query} onChange={setQuery} placeholder="Search name / phone / GSTIN…" />}
          {isSuper && tab === 'sales'
            ? <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setAddSalesOpen(true)}>+ Add salesperson</button>
            : isSuper && <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setAddOpen(true)}>+ Add {tab === 'team' ? 'staff' : 'dealer'}</button>}
        </div>
      </div>

      {isSuper && (
        <div className="admin-tabs">
          <button className={`atab${tab === 'dealers' ? ' on' : ''}`} onClick={() => setTab('dealers')}>Dealers <b>{dealers.length}</b></button>
          <button className={`atab${tab === 'team' ? ' on' : ''}`} onClick={() => setTab('team')}>Team <b>{staff.length}</b></button>
          <button className={`atab${tab === 'sales' ? ' on' : ''}`} onClick={() => setTab('sales')}>Sales <b>{salespeople.length}</b></button>
        </div>
      )}

      {tab === 'dealers' && (
        <>
          <div className="chip-row">
            <button className={`fchip${scheme === 'all' ? ' on' : ''}`} onClick={() => setScheme('all')}>All dealers <b className="fc-n">{inArea.length}</b></button>
            <button className={`fchip sc-active${scheme === 'active' ? ' on' : ''}`} onClick={() => setScheme('active')}>● In-scheme <b className="fc-n">{activeCount}</b></button>
            <button className={`fchip sc-redeem${scheme === 'redeem' ? ' on' : ''}`} onClick={() => setScheme('redeem')}>◦ Redeem-only <b className="fc-n">{redeemCount}</b></button>
          </div>
          <div className="chip-row chip-tiers">
            <button className={`fchip${tierFilter === 'All' ? ' on' : ''}`} onClick={() => setTierFilter('All')}>All tiers <b className="fc-n">{scoped.length}</b></button>
            {[...TIER_ORDER].reverse().map((t) => (
              <button key={t} className={`fchip${tierFilter === t ? ' on' : ''}`} onClick={() => setTierFilter(t)}>{t === 'NoTier' ? 'NoTier' : `◆ ${t}`} <b className="fc-n">{tierCounts[t] ?? 0}</b></button>
            ))}
          </div>
        </>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}
      {users === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {users !== null && tab === 'sales' && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Salesperson</th><th>Username</th><th>Role</th><th>Areas</th><th>Access</th><th></th></tr></thead>
            <tbody>
              {salespeople.map((u) => (
                <tr key={u._id}>
                  <td className="t-strong" data-label="Salesperson">{u.partyName}</td>
                  <td className="hint t-mono" data-label="Username">{u.username}</td>
                  <td data-label="Role">
                    {u.salesReadOnly ? <span className="ro-tag">Sales Head</span> : 'Salesperson'}
                    {!u.salesReadOnly && u.salesHead && <div className="hint">under {headName(u.salesHead)}</div>}
                  </td>
                  <td className="hint" data-label="Areas">{(u.salesAreas ?? []).join(', ') || '—'}</td>
                  <td data-label="Access"><button className={`switch${u.blocked ? '' : ' on'}`} role="switch" aria-checked={!u.blocked} aria-label={`${u.partyName} access`} onClick={() => toggleBlock(u)} /></td>
                  <td className="cell-actions"><div className="t-actions">
                    <button className="mini-btn" onClick={() => setEditSalesFor(u)}>Edit</button>
                    <button className="mini-btn" onClick={() => setResetFor(u)}>Reset password</button>
                  </div></td>
                </tr>
              ))}
              {salespeople.length === 0 && <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 30 }}>No salespeople yet — add one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {users !== null && tab !== 'sales' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{tab === 'dealers' ? 'Dealer' : 'Staff'}</th>
                {tab === 'dealers' ? <th>Area</th> : isSuper && <th>Role</th>}
                <th>Phone</th>
                <th>Points</th><th>Tier</th>{isSuper && <th>Access</th>}{isSuper && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const isDealer = tab === 'dealers';
                const open = expanded === u._id;
                return (
                <Fragment key={u._id}>
                <tr className={isDealer ? `row-click${open ? ' open' : ''}` : ''}>
                  <td data-label={isDealer ? 'Dealer' : 'Staff'}>
                    <div className="t-strong">
                      {isDealer && (
                        <button className="caret-btn" aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open}
                          onClick={() => setExpanded(open ? null : u._id)}><Chevron open={open} /></button>
                      )}
                      {isDealer
                        ? <button className="linklike" onClick={() => setExpanded(open ? null : u._id)}>{u.partyName}</button>
                        : u.partyName}
                      {isDealer && u.inScheme === false && <span className="ro-tag">redeem-only</span>}
                    </div>
                    <div className="hint">
                      {tab === 'dealers'
                        ? <>{u.gstin ? <span className="t-mono">{u.gstin}</span> : <span className="pending">no GSTIN</span>}{!u.profileCompleted && <span className="pending"> · profile pending</span>}</>
                        : (contactName(u) || '—')}
                    </div>
                  </td>
                  {tab === 'dealers' ? <td className="hint" data-label="Area">{u.region || '—'}</td> : isSuper && <td className="hint" data-label="Role">{u.userType}</td>}
                  <td className="t-num" data-label="Phone">{u.phoneNumber}</td>
                  <td className="t-num" data-label="Points">{formatNumber(u.availablePoints)}</td>
                  <td data-label="Tier">
                    {isSuper && u.userType === 'customer' ? (
                      <select className="input" style={{ padding: '5px 8px', width: 118 }} value={u.tier} onChange={(e) => changeTier(u, e.target.value as Tier)}>
                        {TIER_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : <span className="hint">{u.tier}</span>}
                  </td>
                  {isSuper && (
                    <td data-label="Access"><button className={`switch${u.blocked ? '' : ' on'}`} role="switch" aria-checked={!u.blocked} aria-label={`${u.partyName} access`} onClick={() => toggleBlock(u)} /></td>
                  )}
                  {isSuper && (
                    <td className="cell-actions"><div className="t-actions">
                      {u.userType === 'customer' && <button className="mini-btn" onClick={() => setEditFor(u)}>Edit</button>}
                      <button className="mini-btn" onClick={() => setResetFor(u)}>{u.userType === 'customer' ? 'Reset PIN' : 'Reset password'}</button>
                    </div></td>
                  )}
                </tr>
                {isDealer && open && (
                  <tr className="row-detail">
                    <td colSpan={8}><DealerCard userId={u._id} /></td>
                  </tr>
                )}
                </Fragment>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={8} className="hint" style={{ textAlign: 'center', padding: 30 }}>No {tab} found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <AddUserModal isSuper={isSuper} defaultStaff={tab === 'team'} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />}
      {addSalesOpen && <AddSalesModal heads={salesHeads} onClose={() => setAddSalesOpen(false)} onSaved={() => { setAddSalesOpen(false); load(); }} />}
      {editSalesFor && <EditSalesModal user={editSalesFor} heads={salesHeads} onClose={() => setEditSalesFor(null)} onSaved={() => { setEditSalesFor(null); load(); }} />}
      {resetFor && <ResetModal user={resetFor} onClose={() => setResetFor(null)} />}
      {editFor && <EditDealerModal user={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(); }} />}
    </>
  );
}

const toInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Superadmin edit of every dealer field except GSTIN (the definitive key).
function EditDealerModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    partyName: user.partyName ?? '', firstName: user.firstName ?? '', lastName: user.lastName ?? '',
    phoneNumber: user.phoneNumber ?? '', dateOfBirth: toInput(user.dateOfBirth), anniversaryDate: toInput(user.anniversaryDate),
  });
  const [inScheme, setInScheme] = useState(user.inScheme !== false);
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.partyName.trim()) { toastError('Display name cannot be empty.'); return; }
    if (!/^\d{10}$/.test(form.phoneNumber)) { toastError('Phone must be 10 digits.'); return; }
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/users/${user._id}/details`, {
        method: 'PATCH',
        json: {
          partyName: form.partyName.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(),
          phoneNumber: form.phoneNumber.trim(), dateOfBirth: form.dateOfBirth || null, anniversaryDate: form.anniversaryDate || null,
          inScheme,
        },
      });
      toast('Dealer updated');
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Edit · ${user.partyName}`} onClose={onClose}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="dn">Display name</label><input id="dn" className="input" value={form.partyName} onChange={set('partyName')} /></div>
        <div className="field"><label htmlFor="fn">First name</label><input id="fn" className="input" value={form.firstName} onChange={set('firstName')} /></div>
        <div className="field"><label htmlFor="ln">Last name</label><input id="ln" className="input" value={form.lastName} onChange={set('lastName')} /></div>
        <div className="field"><label htmlFor="ph">Phone</label><input id="ph" className="input" inputMode="numeric" value={form.phoneNumber} onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></div>
        <div className="field"><label htmlFor="gs">GSTIN <span className="hint">· locked key</span></label><input id="gs" className="input" value={user.gstin || '—'} readOnly disabled /></div>
        <div className="field"><label htmlFor="db">Date of birth</label><input id="db" className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></div>
        <div className="field"><label htmlFor="an">Anniversary</label><input id="an" className="input" type="date" value={form.anniversaryDate} onChange={set('anniversaryDate')} /></div>
      </div>
      <div className="scheme-toggle">
        <div>
          <div className="st-title">In scheme — earns points</div>
          <div className="st-sub">{inScheme ? 'Real CD dealer: bills credit points, counts in tiers.' : 'Out-of-scheme: can log in & redeem, but earns nothing.'}</div>
        </div>
        <button type="button" className={`switch${inScheme ? ' on' : ''}`} role="switch" aria-checked={inScheme} aria-label="In scheme" onClick={() => setInScheme((v) => !v)} />
      </div>
      <p className="hint">GSTIN is the definitive dealer key and can’t be changed here. Phone must stay unique.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </Modal>
  );
}

function AddUserModal({ isSuper, defaultStaff, onClose, onSaved }: { isSuper: boolean; defaultStaff: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ username: '', partyName: '', phoneNumber: '', gstin: '', password: '', pin: '', userType: defaultStaff ? 'admin' : 'customer' });
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isCustomer = form.userType === 'customer';

  const save = async () => {
    if (!form.partyName || !form.phoneNumber) { toastError('Party name and phone are required.'); return; }
    if (isCustomer) { if (!/^\d{4}$/.test(form.pin)) { toastError('Temp PIN must be exactly 4 digits.'); return; } }
    else if (!form.username || !form.password) { toastError('Username and password are required for staff.'); return; }
    setBusy(true);
    try {
      if (isCustomer) {
        const body = { partyName: form.partyName, phoneNumber: form.phoneNumber, gstin: form.gstin, pin: form.pin };
        await apiJson(isSuper ? '/api/superadmin/sausers' : '/api/admin/add-customer', { method: 'POST', json: isSuper ? { ...body, userType: 'customer' } : body });
      } else {
        await apiJson('/api/superadmin/sausers', { method: 'POST', json: { username: form.username, partyName: form.partyName, phoneNumber: form.phoneNumber, password: form.password, userType: form.userType } });
      }
      toast('Account created');
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={isCustomer ? 'Add dealer' : 'Add staff'} onClose={onClose}>
      <div className="form-grid">
        {isSuper && (
          <div className="field full"><label htmlFor="rt">Role</label>
            <select id="rt" className="input" value={form.userType} onChange={set('userType')}>
              <option value="customer">dealer (customer)</option><option value="admin">admin</option><option value="superadmin">superadmin</option>
            </select></div>
        )}
        <div className="field"><label htmlFor="pn">Party name</label><input id="pn" className="input" value={form.partyName} onChange={set('partyName')} /></div>
        <div className="field"><label htmlFor="ph">Phone</label><input id="ph" className="input" inputMode="numeric" value={form.phoneNumber} onChange={set('phoneNumber')} /></div>
        {isCustomer ? (
          <>
            <div className="field"><label htmlFor="gst">GSTIN</label><input id="gst" className="input" value={form.gstin} onChange={set('gstin')} /></div>
            <div className="field"><label htmlFor="pin">Temp PIN (4 digits)</label><input id="pin" className="input num" inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} /></div>
          </>
        ) : (
          <>
            <div className="field"><label htmlFor="u">Username</label><input id="u" className="input" value={form.username} onChange={set('username')} /></div>
            <div className="field full"><label htmlFor="pw">Temp password</label><input id="pw" className="input" value={form.password} onChange={set('password')} /></div>
          </>
        )}
      </div>
      <p className="hint">{isCustomer ? 'The dealer logs in with their phone + this PIN, then sets their own.' : 'The staff member sets their own password on first login.'}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  );
}

function ResetModal({ user, onClose }: { user: { _id: string; partyName: string; userType: string }; onClose: () => void }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();
  const isCustomer = user.userType === 'customer';

  const save = async () => {
    if (isCustomer) { if (!/^\d{4}$/.test(val)) { toastError('Temp PIN must be exactly 4 digits.'); return; } }
    else if (val.length < 6) { toastError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/users/${user._id}/reset-password`, { method: 'POST', json: { newPassword: val } });
      toast(isCustomer ? `PIN reset for ${user.partyName}` : `Password reset for ${user.partyName}`);
      onClose();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`${isCustomer ? 'Reset PIN' : 'Reset password'} · ${user.partyName}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="np">{isCustomer ? 'New temporary PIN (4 digits)' : 'New temporary password'}</label>
        <input id="np" className={`input${isCustomer ? ' num' : ''}`} inputMode={isCustomer ? 'numeric' : undefined} maxLength={isCustomer ? 4 : undefined}
          value={val} onChange={(e) => setVal(isCustomer ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)} />
      </div>
      <p className="hint">{isCustomer ? 'The dealer sets their own PIN at next login.' : 'The staff member sets their own password at next login.'}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Resetting…' : 'Reset'}</button>
      </div>
    </Modal>
  );
}

// Create a sales-team login: name, username, temp password, role (rep / read-only
// head) and one or more areas. Scope is derived from the areas server-side.
type SalesHead = { username: string; partyName: string };

function AddSalesModal({ heads, onClose, onSaved }: { heads: SalesHead[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ partyName: '', username: '', password: '' });
  const [readOnly, setReadOnly] = useState(false);
  const [head, setHead] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [allAreas, setAllAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();
  useEffect(() => { apiJson<{ areas: string[] }>('/api/superadmin/sales-areas').then((d) => setAllAreas(d.areas)).catch(() => {}); }, []);
  const set = (k: 'partyName' | 'username' | 'password') => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleArea = (a: string) => setAreas((x) => x.includes(a) ? x.filter((y) => y !== a) : [...x, a]);

  const save = async () => {
    if (!form.partyName.trim() || !form.username.trim() || !form.password) { toastError('Name, username and a temp password are required.'); return; }
    if (areas.length === 0) { toastError('Assign at least one area.'); return; }
    setBusy(true);
    try {
      await apiJson('/api/superadmin/sales-user', { method: 'POST', json: { partyName: form.partyName.trim(), username: form.username.trim(), password: form.password, areas, readOnly, salesHead: readOnly ? undefined : (head || undefined) } });
      toast(`${form.partyName.trim()} created`);
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Add salesperson" onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label htmlFor="sp-n">Name</label><input id="sp-n" className="input" value={form.partyName} onChange={set('partyName')} /></div>
        <div className="field"><label htmlFor="sp-u">Username</label><input id="sp-u" className="input" value={form.username} onChange={set('username')} /></div>
        <div className="field full"><label htmlFor="sp-p">Temp password</label><input id="sp-p" className="input" value={form.password} onChange={set('password')} /></div>
      </div>
      <div className="scheme-toggle">
        <div>
          <div className="st-title">Sales Head — view only</div>
          <div className="st-sub">{readOnly ? 'Oversees these areas; cannot edit bills/orders.' : 'Full access within these areas.'}</div>
        </div>
        <button type="button" className={`switch${readOnly ? ' on' : ''}`} role="switch" aria-checked={readOnly} aria-label="Sales head" onClick={() => setReadOnly((v) => !v)} />
      </div>
      {!readOnly && (
        <div className="field">
          <label htmlFor="sp-h">Reports to <span className="hint">· sales head</span></label>
          <select id="sp-h" className="input" value={head} onChange={(e) => setHead(e.target.value)}>
            <option value="">— none —</option>
            {heads.map((h) => <option key={h.username} value={h.username}>{h.partyName}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label>Areas <span className="hint">· pick one or more</span></label>
        <div className="chip-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {allAreas.map((a) => <button key={a} type="button" className={`fchip${areas.includes(a) ? ' on' : ''}`} onClick={() => toggleArea(a)}>{a}</button>)}
        </div>
      </div>
      <p className="hint">They sign in via <b>Staff login</b> with this username + temp password, then set their own on first login.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  );
}

function EditSalesModal({ user, heads, onClose, onSaved }: { user: UserRow; heads: SalesHead[]; onClose: () => void; onSaved: () => void }) {
  const [partyName, setPartyName] = useState(user.partyName);
  const [readOnly, setReadOnly] = useState(!!user.salesReadOnly);
  const [head, setHead] = useState(user.salesHead ?? '');
  const [areas, setAreas] = useState<string[]>(user.salesAreas ?? []);
  const [allAreas, setAllAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();
  useEffect(() => { apiJson<{ areas: string[] }>('/api/superadmin/sales-areas').then((d) => setAllAreas(d.areas)).catch(() => {}); }, []);
  const toggleArea = (a: string) => setAreas((x) => x.includes(a) ? x.filter((y) => y !== a) : [...x, a]);
  // A head can't report to themselves; exclude this user from the head list.
  const headOptions = heads.filter((h) => h.username !== user.username);

  const save = async () => {
    if (!partyName.trim()) { toastError('Name is required.'); return; }
    if (areas.length === 0) { toastError('Assign at least one area.'); return; }
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/sales-user/${user._id}`, { method: 'PATCH', json: { partyName: partyName.trim(), areas, readOnly, salesHead: readOnly ? null : (head || null) } });
      toast(`${partyName.trim()} updated`);
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Edit · ${user.partyName}`} onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label htmlFor="es-n">Name</label><input id="es-n" className="input" value={partyName} onChange={(e) => setPartyName(e.target.value)} /></div>
        <div className="field"><label htmlFor="es-u">Username</label><input id="es-u" className="input" value={user.username} disabled title="Login username can't be changed" /></div>
      </div>
      <div className="scheme-toggle">
        <div>
          <div className="st-title">Sales Head — view only</div>
          <div className="st-sub">{readOnly ? 'Oversees these areas; cannot edit bills/orders.' : 'Full access within these areas.'}</div>
        </div>
        <button type="button" className={`switch${readOnly ? ' on' : ''}`} role="switch" aria-checked={readOnly} aria-label="Sales head" onClick={() => setReadOnly((v) => !v)} />
      </div>
      {!readOnly && (
        <div className="field">
          <label htmlFor="es-h">Reports to <span className="hint">· sales head</span></label>
          <select id="es-h" className="input" value={head} onChange={(e) => setHead(e.target.value)}>
            <option value="">— none —</option>
            {headOptions.map((h) => <option key={h.username} value={h.username}>{h.partyName}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label>Areas <span className="hint">· pick one or more</span></label>
        <div className="chip-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {allAreas.map((a) => <button key={a} type="button" className={`fchip${areas.includes(a) ? ' on' : ''}`} onClick={() => toggleArea(a)}>{a}</button>)}
        </div>
      </div>
      <p className="hint">Changing areas re-scopes which dealers, bills and orders they see. Use <b>Reset password</b> to issue a new temp password.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </Modal>
  );
}
