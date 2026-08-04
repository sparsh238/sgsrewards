import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiJson, IMAGE_BASE } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useToast } from '../lib/toast';
import { useCart } from '../lib/cart';
import { itemPrice, type CartEntry, type Item, type Order } from '../lib/types';
import AppBar from '../components/AppBar';

// One checkout for both entry points:
//   { mode: 'buynow', item, quantity } — direct purchase of a single item
//   { mode: 'cart' }                   — checkout of the saved cart
type CheckoutState =
  | { mode: 'buynow'; item: Item; quantity?: number }
  | { mode: 'cart' }
  | null;

interface Line {
  itemId: string;
  name: string;
  image?: string;
  quantity: number;
  price: number; // per unit, after discount
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toastError } = useToast();
  const { reload: reloadCart } = useCart();
  const state = (location.state ?? null) as CheckoutState;
  const buynow = state?.mode === 'buynow';

  const [lines, setLines] = useState<Line[] | null>(null);
  const [qty, setQty] = useState(state?.mode === 'buynow' ? Math.max(1, state.quantity ?? 1) : 1);
  const [points, setPoints] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) { navigate('/shop', { replace: true }); return; }
    let cancelled = false;
    (async () => {
      try {
        const pts = await apiJson<{ availablePoints: number }>('/api/user/points');
        if (cancelled) return;
        setPoints(pts.availablePoints);
        if (state.mode === 'buynow') {
          const it = state.item;
          setLines([{ itemId: it._id, name: it.name, image: it.images?.[0], quantity: 1, price: itemPrice(it) }]);
        } else {
          const cart = await apiJson<{ items: CartEntry[] }>('/api/user/cart');
          if (cancelled) return;
          setLines(cart.items.filter((e) => e.itemId !== null).map((e) => ({
            itemId: e.itemId!._id, name: e.itemId!.name, image: e.itemId!.images?.[0],
            quantity: e.quantity, price: itemPrice(e.itemId!),
          })));
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  // Buy-now total tracks the editable quantity; cart total is fixed by the cart.
  const unit = lines?.[0]?.price ?? 0;
  const total = buynow ? unit * qty : (lines ?? []).reduce((s, l) => s + l.price * l.quantity, 0);
  const units = buynow ? qty : (lines ?? []).reduce((s, l) => s + l.quantity, 0);
  const insufficient = points !== null && total > points;
  const balanceAfter = points !== null ? points - total : 0;

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const order = await apiJson<Order>('/api/user/cart/checkout', {
        method: 'POST',
        json: buynow ? { items: [{ itemId: lines![0].itemId, quantity: qty }] } : {},
      });
      if (!buynow) await reloadCart();
      navigate('/order-placed', { replace: true, state: { order } });
    } catch (err) {
      toastError((err as Error).message);
      setPlacing(false);
      setConfirming(false);
    }
  };

  return (
    <div className="page">
      <AppBar title={buynow ? 'Buy now' : 'Cart'} fallback={buynow ? '/shop' : '/cart'} />

      {error && <div className="error-banner" role="alert">{error}</div>}
      {lines === null && !error && <div className="skeleton" style={{ height: 160 }} />}

      {lines !== null && lines.length === 0 && (
        <div className="empty"><b>Nothing to review</b><span>Your cart is empty.</span></div>
      )}

      {buynow && lines?.[0] && (
        <>
          <div className="cart-row" style={{ position: 'static' }}>
            <div className="cart-thumb">{lines[0].image && <img src={`${IMAGE_BASE}/${lines[0].image}`} alt="" />}</div>
            <div className="cart-info">
              <div className="cart-name">{lines[0].name}</div>
              <div className="cart-pts num">{formatNumber(unit)} pts each</div>
            </div>
          </div>
          <div className="qty-row">
            <span className="qty-lab">Quantity</span>
            <div className="qty-step">
              <button aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="q num">{qty}</span>
              <button aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>＋</button>
            </div>
          </div>
        </>
      )}

      {!buynow && (lines ?? []).map((l) => (
        <div key={l.itemId} className="cart-row" style={{ position: 'static' }}>
          <div className="cart-thumb">{l.image && <img src={`${IMAGE_BASE}/${l.image}`} alt="" />}</div>
          <div className="cart-info">
            <div className="cart-name">{l.name}</div>
            <div className="cart-pts num">{l.quantity} × {formatNumber(l.price)} pts</div>
          </div>
        </div>
      ))}

      {lines !== null && lines.length > 0 && (
        <>
          <div className="breakdown">
            {buynow && <div className="bd-row"><span>{formatNumber(unit)} × {qty}</span><b className="num">{formatNumber(total)} pts</b></div>}
            <div className="bd-row total"><span>Total</span><span className="v num">{formatNumber(total)} pts</span></div>
          </div>
          {points !== null && (
            insufficient
              ? <div className="error-banner" role="alert">You need <b className="num">{formatNumber(total - points)}</b> more points for this order.</div>
              : <div className="after-line"><span className="num">Balance {formatNumber(points)}</span><span className="num">→ after {formatNumber(balanceAfter)} pts</span></div>
          )}
          <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={insufficient}>
            Review redemption
          </button>
        </>
      )}

      {confirming && lines && (
        <div className="sheet-scrim" onClick={() => !placing && setConfirming(false)}>
          <div className="sheet confirm-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirm redemption">
            <div className="sheet-title">Confirm redemption</div>
            <div className="hint">{buynow ? 1 : lines.length} item{(buynow ? 1 : lines.length) > 1 ? 's' : ''} · {units} unit{units > 1 ? 's' : ''}</div>
            <div className="pts-swap">
              <div><div className="ps-v num">{formatNumber(points ?? 0)}</div><div className="ps-l">NOW</div></div>
              <span className="ps-arr" aria-hidden="true">→</span>
              <div><div className="ps-v to num">{formatNumber(balanceAfter)}</div><div className="ps-l">AFTER</div></div>
            </div>
            <div className="hint" style={{ textAlign: 'center' }}>
              <b className="cost num">{formatNumber(total)}</b> pts will be redeemed. This can't be undone.
            </div>
            <div className="sheet-btns">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={placing}>Cancel</button>
              <button className="btn btn-primary" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing…' : `Confirm · ${formatNumber(total)} pts`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
