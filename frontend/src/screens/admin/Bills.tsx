import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { formatDate, formatNumber } from '../../lib/format';
import { type Tier } from '../../lib/tier';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import Chevron from '../../components/Chevron';
import DealerPicker from '../../components/DealerPicker';
import DealerCard from './DealerCard';
import BillItems, { type LineItem } from '../../components/BillItems';

// "2026-07" -> "Jul 2026" for the month filter.
const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  if (!y || !m) return p;
  return `${new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' })} ${y}`;
};

interface BillRow {
  _id: string;
  billNumber: string;
  billDate: string;
  billAmount: number;
  pointsAwarded?: number;
  tierAtBill?: Tier;
  period?: string;
  source?: string;
  locked?: boolean;
  excluded?: boolean;
  lineItems?: LineItem[];
  userId: { _id?: string; partyName?: string; phoneNumber?: string; tier?: Tier; region?: string } | null;
}
interface Dealer { _id: string; username: string; partyName: string; tier: Tier; region?: string }
interface BillsResp { items: BillRow[]; total: number; page: number; pageSize: number; periods: string[] }
type Conversion = Partial<Record<Tier, number>>;

// Mirrors the backend's pointsForBill so the admin sees the true award before saving.
function previewPoints(amount: number, tier: Tier | undefined, conv: Conversion): number | null {
  if (!amount || amount <= 0) return null;
  if (!tier || tier === 'NoTier') return 0;
  const rate = conv[tier];
  if (!rate || rate <= 0) return 0;
  return Math.ceil(amount / rate);
}

const PAGE_SIZE = 25;

export default function Bills() {
  const [data, setData] = useState<BillsResp | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [conv, setConv] = useState<Conversion>({});
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; bill: BillRow }>(null);
  const { toast, toastError } = useToast();
  const { auth } = useAuth();
  const isSales = auth.userType === 'sales'; // sales are read-only on bills

  // Filters + pagination
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState('');
  const [region, setRegion] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dealerOpen, setDealerOpen] = useState<string | null>(null);

  // Reset to page 1 in the SAME update as any filter change (below and in the
  // select handlers) — a separate reset-effect would let load() fire once with a
  // stale page before the reset lands, racing two requests.
  useEffect(() => { const t = setTimeout(() => { setPage(1); setDebounced(search); }, 300); return () => clearTimeout(t); }, [search]);

  const load = () => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (period) p.set('period', period);
    if (region) p.set('region', region);
    if (source) p.set('source', source);
    if (debounced) p.set('search', debounced);
    apiJson<BillsResp>(`/api/bill?${p.toString()}`).then(setData).catch((e) => setError((e as Error).message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, period, region, source, debounced]);
  useEffect(() => {
    apiJson<Dealer[]>('/api/admin/users').then(setDealers).catch(() => {});
    apiJson<{ tierPointsConversion: Conversion }>('/api/superadmin/system/points-conversion')
      .then((d) => setConv(d.tierPointsConversion || {})).catch(() => {});
  }, []);

  const regions = useMemo(() => [...new Set(dealers.map((d) => d.region).filter(Boolean) as string[])].sort(), [dealers]);

  const remove = async (bill: BillRow) => {
    const synced = (bill.source ?? 'manual') === 'busy';
    const msg = synced
      ? `Delete synced bill #${bill.billNumber}? Its points will be removed from ${bill.userId?.partyName ?? 'the dealer'}, and the daily Busy sync will not bring it back.`
      : `Delete bill #${bill.billNumber}? The dealer's points will be adjusted.`;
    if (!window.confirm(msg)) return;
    try {
      await apiJson(`/api/bill/${bill._id}`, { method: 'DELETE' });
      toast('Bill deleted');
      load();
    } catch (err) { toastError((err as Error).message); }
  };

  const toggleExclude = async (bill: BillRow) => {
    const next = !bill.excluded;
    const msg = next
      ? `Disregard bill #${bill.billNumber}? It will award no points and drop out of ${bill.userId?.partyName ?? 'the dealer'}'s tier turnover. You can re-include it later.`
      : `Re-include bill #${bill.billNumber}? Points will be credited again at the dealer's current tier.`;
    if (!window.confirm(msg)) return;
    try {
      await apiJson(`/api/bill/${bill._id}/exclude`, { method: 'PATCH', json: { excluded: next } });
      toast(next ? 'Bill disregarded' : 'Bill re-included');
      load();
    } catch (err) { toastError((err as Error).message); }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const periods = data?.periods ?? [];

  return (
    <>
      <div className="admin-head">
        <div><h1>Bills</h1><p className="page-sub">{isSales ? "Your dealers' bills this quarter." : "Recording a bill credits points by the dealer's tier rate."}</p></div>
        <div className="admin-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bill / dealer…" />
          {!isSales && (
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setModal({ mode: 'add' })}>
              + Add bill
            </button>
          )}
        </div>
      </div>

      <div className="chip-row" style={{ gap: 10 }}>
        <select className="input" style={{ width: 'auto' }} value={period} onChange={(e) => { setPage(1); setPeriod(e.target.value); }}>
          <option value="">All months</option>
          {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={region} onChange={(e) => { setPage(1); setRegion(e.target.value); }}>
          <option value="">All areas</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }}>
          <option value="">All sources</option>
          <option value="manual">Manual</option>
          <option value="busy">Busy sync</option>
        </select>
        {(period || region || source || debounced) && (
          <button className="fchip" onClick={() => { setPage(1); setPeriod(''); setRegion(''); setSource(''); setSearch(''); }}>Clear filters</button>
        )}
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {data === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {data !== null && (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Bill #</th><th>Dealer</th><th>Area</th><th>Tier</th><th>Amount</th><th>Points</th><th>Date</th><th>Source</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const busy = (b.source ?? 'manual') === 'busy';
                  const hasItems = (b.lineItems?.length ?? 0) > 0;
                  const open = expanded === b._id;
                  return (
                    <Fragment key={b._id}>
                    <tr className={b.excluded ? 'bill-excluded' : ''}>
                      <td className="t-strong t-mono" data-label="Bill #">
                        {hasItems && (
                          <button className="caret-btn" aria-label={open ? 'Hide items' : 'Show items'} aria-expanded={open}
                            onClick={() => setExpanded(open ? null : b._id)}><Chevron open={open} /></button>
                        )}
                        {b.billNumber}
                      </td>
                      <td data-label="Dealer">
                        <div className="t-strong">
                          {b.userId?._id
                            ? <button className="linklike" onClick={() => setDealerOpen(dealerOpen === b._id ? null : b._id)}>{b.userId?.partyName ?? '—'}</button>
                            : (b.userId?.partyName ?? '—')}
                        </div>
                        <div className="hint">{b.userId?.phoneNumber ?? ''}</div>
                      </td>
                      <td className="hint" data-label="Area">{b.userId?.region || '—'}</td>
                      <td className="hint" data-label="Tier">{b.tierAtBill || b.userId?.tier || '—'}</td>
                      <td className="t-num" data-label="Amount">₹{formatNumber(b.billAmount)}</td>
                      <td className="t-num" data-label="Points">{b.excluded ? <span className="pending" title="Disregarded — earns no points">+0</span> : b.pointsAwarded ? `+${formatNumber(b.pointsAwarded)}` : <span className="pending">+0</span>}</td>
                      <td className="hint" data-label="Date">{formatDate(b.billDate)}</td>
                      <td data-label="Source">
                        <div className="src-tags">
                        {busy
                          ? <span className="src-tag busy" title={b.locked ? 'Synced from Busy — you edited this, so the daily sync no longer touches it' : 'Synced from the daily Busy push'}>{b.locked ? 'synced · edited' : 'synced'}</span>
                          : <span className="src-tag">manual</span>}
                        {b.excluded && <span className="src-tag excl" title="Disregarded: no points, out of tier turnover">excluded</span>}
                        </div>
                      </td>
                      {!isSales && (
                        <td className="cell-actions">
                          <div className="t-actions">
                            <button className="mini-btn" onClick={() => setModal({ mode: 'edit', bill: b })}>Edit</button>
                            <button className="mini-btn" onClick={() => toggleExclude(b)} title={b.excluded ? 'Credit points again' : 'Award no points for this bill'}>{b.excluded ? 'Include' : 'Exclude'}</button>
                            <button className="mini-btn danger" onClick={() => remove(b)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {dealerOpen === b._id && b.userId?._id && (
                      <tr className="row-detail">
                        <td colSpan={9}><DealerCard userId={b.userId._id} /></td>
                      </tr>
                    )}
                    {open && hasItems && (
                      <tr className="row-detail">
                        <td colSpan={9}><BillItems items={b.lineItems!} /></td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={9} className="hint" style={{ textAlign: 'center', padding: 30 }}>No bills match these filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span className="hint">{total.toLocaleString('en-IN')} bill{total === 1 ? '' : 's'}{period || region || source || debounced ? ' (filtered)' : ''}</span>
            <div className="pager-ctl">
              <button className="mini-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
              <span className="hint">Page {page} of {pages}</span>
              <button className="mini-btn" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
            </div>
          </div>
        </>
      )}

      {modal && (
        <BillModal
          mode={modal.mode}
          bill={modal.mode === 'edit' ? modal.bill : undefined}
          dealers={dealers}
          conv={conv}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

function BillModal({ mode, bill, dealers, conv, onClose, onSaved }: {
  mode: 'add' | 'edit';
  bill?: BillRow;
  dealers: Dealer[];
  conv: Conversion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dealerId, setDealerId] = useState(bill?.userId?._id ?? '');
  const [billNumber, setBillNumber] = useState(bill?.billNumber ?? '');
  const [billDate, setBillDate] = useState(bill?.billDate ? bill.billDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [billAmount, setBillAmount] = useState(bill ? String(bill.billAmount) : '');
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();

  // Editing a synced (Busy) bill: pin the invoice number + date so the daily
  // sync can always re-match this locked bill by (billNumber|period) and never
  // re-insert a duplicate. Only the amount stays editable.
  const isBusyEdit = mode === 'edit' && (bill?.source ?? 'manual') === 'busy';

  // In edit mode the dealer/tier comes from the bill; in add mode from the picker.
  const tier: Tier | undefined = mode === 'edit'
    ? bill?.userId?.tier
    : dealers.find((d) => d._id === dealerId)?.tier;
  const amount = parseFloat(billAmount);
  const preview = previewPoints(amount, tier, conv);

  const save = async () => {
    if (!(amount > 0)) { toastError('Enter a valid bill amount.'); return; }
    if (mode === 'add' && !dealerId) { toastError('Select a dealer.'); return; }
    setBusy(true);
    try {
      if (mode === 'add') {
        await apiJson('/api/bill', { method: 'POST', json: { userId: dealerId, billNumber, billDate, billAmount: amount } });
        toast('Bill added');
      } else {
        await apiJson(`/api/bill/${bill!._id}`, { method: 'PATCH', json: { billNumber, billDate, billAmount: amount } });
        toast('Bill updated');
      }
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={mode === 'add' ? 'Add bill' : `Edit bill #${bill?.billNumber}`} onClose={onClose}>
      {mode === 'add' ? (
        <div className="field">
          <label>Dealer</label>
          <DealerPicker dealers={dealers} value={dealerId} onChange={setDealerId} autoFocus />
        </div>
      ) : (
        <>
          <p className="hint">Dealer: <b>{bill?.userId?.partyName}</b> · {bill?.userId?.tier ?? 'No tier'}</p>
          {(bill?.source ?? 'manual') === 'busy' && (
            <p className="hint" style={{ color: 'var(--warn, #d9a441)' }}>
              Synced Busy bill — you can correct the <b>amount</b>. The invoice number and date are locked so the daily sync keeps matching it (no duplicates). Saving takes its points under manual control.
            </p>
          )}
        </>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="bn">Bill number {isBusyEdit && <span className="hint">· locked</span>}</label>
          <input id="bn" className="input" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} disabled={isBusyEdit} title={isBusyEdit ? "Synced invoice number can't be changed" : undefined} />
        </div>
        <div className="field">
          <label htmlFor="bd">Bill date {isBusyEdit && <span className="hint">· locked</span>}</label>
          <input id="bd" className="input" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} disabled={isBusyEdit} title={isBusyEdit ? "Synced bill date can't be changed" : undefined} />
        </div>
        <div className="field full">
          <label htmlFor="ba">Bill amount (₹)</label>
          <input id="ba" className="input" type="number" inputMode="decimal" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
        </div>
      </div>

      <div className="hint">
        {tier
          ? preview === null
            ? 'Enter an amount to preview points.'
            : preview === 0
              ? `No points — ${tier === 'NoTier' ? 'dealer has no tier' : `no rate set for ${tier}`}.`
              : `Will credit ≈ ${formatNumber(preview)} points (${tier} rate).`
          : 'Select a dealer to preview points.'}
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}
