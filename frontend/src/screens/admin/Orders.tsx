import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { formatDate, formatNumber } from '../../lib/format';
import SearchInput from '../../components/SearchInput';
import { matchesSearch } from '../../lib/search';
import DealerCard from './DealerCard';

interface AdminOrder {
  _id: string;
  orderIdAlias: string;
  userId: { _id?: string; partyName?: string; phoneNumber?: string } | null;
  totalValue: number;
  orderDate: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  items: { itemId: { name?: string; pointsRequired?: number; discount?: number } | null; quantity: number }[];
  address?: { addressLine1?: string; city?: string; pinCode?: string } | null;
}

const STATUSES: AdminOrder['status'][] = ['Pending', 'Completed', 'Cancelled'];

export default function Orders() {
  const { auth } = useAuth();
  const isSales = auth.userType === 'sales'; // sales can't change order status
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | AdminOrder['status']>('All');
  const [dealerOpen, setDealerOpen] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { toast, toastError } = useToast();

  useEffect(() => {
    apiJson<AdminOrder[]>('/api/admin/orders')
      .then((d) => setOrders([...d].reverse()))
      .catch((e) => setError((e as Error).message));
  }, []);

  const changeStatus = async (order: AdminOrder, status: AdminOrder['status']) => {
    const prev = order.status;
    setOrders((os) => os?.map((o) => (o._id === order._id ? { ...o, status } : o)) ?? null);
    try {
      await apiJson(`/api/admin/${order._id}/status`, { method: 'PATCH', json: { status } });
      toast(`Order ${order.orderIdAlias} → ${status}${status === 'Cancelled' ? ' (points refunded)' : ''}`);
    } catch (err) {
      setOrders((os) => os?.map((o) => (o._id === order._id ? { ...o, status: prev } : o)) ?? null);
      toastError((err as Error).message);
    }
  };

  const visible = useMemo(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'All' && o.status !== filter) return false;
      if (!q) return true;
      return matchesSearch(o.orderIdAlias, query)
        || matchesSearch(o.userId?.partyName ?? '', query)
        || matchesSearch(o.userId?.phoneNumber ?? '', query);
    });
  }, [orders, query, filter]);

  return (
    <>
      <div className="admin-head">
        <div><h1>Orders</h1><p className="page-sub">{isSales ? "Redemption orders placed by your dealers." : "Update fulfilment status. Cancelling refunds the dealer's points."}</p></div>
        <div className="admin-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search order / dealer / phone…" />
        </div>
      </div>

      <div className="chip-row">
        {(['All', ...STATUSES] as const).map((s) => {
          const n = s === 'All' ? (orders?.length ?? 0) : (orders?.filter((o) => o.status === s).length ?? 0);
          return <button key={s} className={`fchip${filter === s ? ' on' : ''} st-${s.toLowerCase()}`} onClick={() => setFilter(s)}>{s} <b className="fc-n">{n}</b></button>;
        })}
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {orders === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {orders !== null && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th><th>Dealer</th><th>Items</th><th>Points</th><th>Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <Fragment key={o._id}>
                <tr>
                  <td className="t-strong t-num" data-label="Order">
                    <button className="ord-toggle" onClick={() => setItemsOpen(itemsOpen === o._id ? null : o._id)} title={itemsOpen === o._id ? 'Hide items' : 'Show items'} aria-expanded={itemsOpen === o._id}>
                      <span className={`ord-chev${itemsOpen === o._id ? ' open' : ''}`}><svg viewBox="0 0 10 10"><path d="M3 1 L7 5 L3 9" /></svg></span>
                      {o.orderIdAlias}
                    </button>
                  </td>
                  <td data-label="Dealer">
                    <div className="t-strong">
                      {o.userId?._id
                        ? <button className="linklike" onClick={() => setDealerOpen(dealerOpen === o._id ? null : o._id)}>{o.userId?.partyName ?? '—'}</button>
                        : (o.userId?.partyName ?? '—')}
                    </div>
                    <div className="hint">{o.userId?.phoneNumber ?? ''}</div>
                  </td>
                  <td data-label="Items">
                    {o.items[0]?.itemId?.name ?? 'items'}
                    {o.items.length > 1 && <span className="hint"> +{o.items.length - 1} more</span>}
                  </td>
                  <td className="t-num" data-label="Points">{formatNumber(o.totalValue)}</td>
                  <td className="hint" data-label="Date">{formatDate(o.orderDate)}</td>
                  <td data-label="Status">
                    {isSales ? (
                      <span className={`pill ${o.status.toLowerCase()}`}>{o.status}</span>
                    ) : (
                      <select
                        className={`pill ${o.status.toLowerCase()}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                        value={o.status}
                        onChange={(e) => changeStatus(o, e.target.value as AdminOrder['status'])}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
                {itemsOpen === o._id && (
                  <tr className="row-detail"><td colSpan={6}>
                    <div className="ord-receipt">
                      <div className="ord-rh">{o.items.length} item{o.items.length === 1 ? '' : 's'} redeemed</div>
                      {o.items.map((it, i) => {
                        const unit = Math.max(0, (it.itemId?.pointsRequired ?? 0) - (it.itemId?.discount ?? 0));
                        return (
                          <div className="ord-li" key={i}>
                            <span className="ord-li-name"><span className="ord-dot" />{it.itemId?.name ?? 'Item'}</span>
                            <span className="ord-calc"><b className="tnum">{formatNumber(unit)}</b> pts × {it.quantity}</span>
                            <span className="ord-li-total tnum">{formatNumber(unit * it.quantity)}</span>
                          </div>
                        );
                      })}
                      <div className="ord-total">
                        <span className="lab">Total redeemed</span>
                        <span className="val tnum">{formatNumber(o.totalValue)} <small>pts</small></span>
                      </div>
                    </div>
                  </td></tr>
                )}
                {dealerOpen === o._id && o.userId?._id && (
                  <tr className="row-detail"><td colSpan={6}><DealerCard userId={o.userId._id} /></td></tr>
                )}
                </Fragment>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 30 }}>No orders match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
