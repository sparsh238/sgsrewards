import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDate, formatNumber } from '../../lib/format';
import type { Tier } from '../../lib/tier';
import Modal from '../../components/Modal';

interface BillRow {
  _id: string;
  billNumber: string;
  billDate: string;
  billAmount: number;
  pointsAwarded?: number;
  tierAtBill?: Tier;
  userId: { _id?: string; partyName?: string; phoneNumber?: string; tier?: Tier } | null;
}
interface Dealer { _id: string; username: string; partyName: string; tier: Tier }
type Conversion = Partial<Record<Tier, number>>;

// Mirrors the backend's pointsForBill so the admin sees the true award before saving.
function previewPoints(amount: number, tier: Tier | undefined, conv: Conversion): number | null {
  if (!amount || amount <= 0) return null;
  if (!tier || tier === 'NoTier') return 0;
  const rate = conv[tier];
  if (!rate || rate <= 0) return 0;
  return Math.ceil(amount / rate);
}

export default function Bills() {
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [conv, setConv] = useState<Conversion>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; bill: BillRow }>(null);
  const { toast, toastError } = useToast();

  const load = () => {
    apiJson<BillRow[]>('/api/bill').then((d) => setBills([...d].reverse())).catch((e) => setError((e as Error).message));
  };
  useEffect(() => {
    load();
    apiJson<Dealer[]>('/api/admin/users').then(setDealers).catch(() => {});
    apiJson<{ tierPointsConversion: Conversion }>('/api/superadmin/system/points-conversion')
      .then((d) => setConv(d.tierPointsConversion || {})).catch(() => {});
  }, []);

  const remove = async (bill: BillRow) => {
    if (!window.confirm(`Delete bill #${bill.billNumber}? The dealer's points will be adjusted.`)) return;
    try {
      await apiJson(`/api/bill/${bill._id}`, { method: 'DELETE' });
      toast('Bill deleted');
      load();
    } catch (err) { toastError((err as Error).message); }
  };

  const visible = useMemo(() => {
    if (!bills) return [];
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) => b.billNumber.toLowerCase().includes(q)
      || (b.userId?.partyName ?? '').toLowerCase().includes(q)
      || (b.userId?.phoneNumber ?? '').includes(q));
  }, [bills, query]);

  return (
    <>
      <div className="admin-head">
        <div><h1>Bills</h1><p className="page-sub">Recording a bill credits points by the dealer's tier rate.</p></div>
        <div className="admin-toolbar">
          <input className="input" placeholder="Search bill / dealer…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setModal({ mode: 'add' })}>
            + Add bill
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {bills === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {bills !== null && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Bill #</th><th>Dealer</th><th>Tier</th><th>Amount</th><th>Points</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b._id}>
                  <td className="t-strong t-mono">{b.billNumber}</td>
                  <td><div className="t-strong">{b.userId?.partyName ?? '—'}</div><div className="hint">{b.userId?.phoneNumber ?? ''}</div></td>
                  <td className="hint">{b.tierAtBill || b.userId?.tier || '—'}</td>
                  <td className="t-num">₹{formatNumber(b.billAmount)}</td>
                  <td className="t-num">{b.pointsAwarded ? `+${formatNumber(b.pointsAwarded)}` : <span className="pending">+0</span>}</td>
                  <td className="hint">{formatDate(b.billDate)}</td>
                  <td>
                    <div className="t-actions">
                      <button className="mini-btn" onClick={() => setModal({ mode: 'edit', bill: b })}>Edit</button>
                      <button className="mini-btn danger" onClick={() => remove(b)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={7} className="hint" style={{ textAlign: 'center', padding: 30 }}>No bills yet.</td></tr>}
            </tbody>
          </table>
        </div>
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
          <label htmlFor="dealer">Dealer</label>
          <select id="dealer" className="input" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
            <option value="">Select a dealer…</option>
            {dealers.map((d) => <option key={d._id} value={d._id}>{d.partyName} ({d.username}) · {d.tier}</option>)}
          </select>
        </div>
      ) : (
        <p className="hint">Dealer: <b>{bill?.userId?.partyName}</b> · {bill?.userId?.tier ?? 'No tier'}</p>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="bn">Bill number</label>
          <input id="bn" className="input" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bd">Bill date</label>
          <input id="bd" className="input" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
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
