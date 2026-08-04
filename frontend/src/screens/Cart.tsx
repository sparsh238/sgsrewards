import { Link, useNavigate } from 'react-router-dom';
import { IMAGE_BASE } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useCart } from '../lib/cart';
import { itemPrice } from '../lib/types';

export default function Cart() {
  const { entries, loaded, totalPts, pendingId, setQty, remove } = useCart();
  const navigate = useNavigate();

  return (
    <div className="page">
      <h1 className="page-title">Cart</h1>

      {!loaded && (
        <>
          <div className="skeleton" style={{ height: 84 }} />
          <div className="skeleton" style={{ height: 84 }} />
        </>
      )}

      {loaded && entries.length === 0 && (
        <div className="empty">
          <span className="big" aria-hidden="true">🛒</span>
          <b>Your cart is empty</b>
          <span>Rewards you add will appear here.</span>
          <Link to="/shop" className="btn btn-primary" style={{ width: 'auto', padding: '11px 24px' }}>
            Browse rewards
          </Link>
        </div>
      )}

      {entries.map((e) => {
        const it = e.itemId!;
        const busy = pendingId === it._id;
        return (
          <div key={it._id} className="cart-row">
            <button
              className="cart-x"
              aria-label={`Remove ${it.name} from cart`}
              disabled={busy}
              onClick={() => void remove(it._id)}
            >✕</button>
            <div className="cart-thumb">
              {it.images?.[0] && <img src={`${IMAGE_BASE}/${it.images[0]}`} alt="" />}
            </div>
            <div className="cart-info">
              <div className="cart-name">{it.name}</div>
              <div className="cart-pts num">{formatNumber(itemPrice(it) * e.quantity)} pts</div>
              <div className="stepper">
                <button aria-label="Decrease quantity" disabled={busy || e.quantity <= 1} onClick={() => void setQty(it._id, e.quantity - 1)}>−</button>
                <span className="qty num">{e.quantity}</span>
                <button aria-label="Increase quantity" disabled={busy} onClick={() => void setQty(it._id, e.quantity + 1)}>+</button>
              </div>
            </div>
          </div>
        );
      })}

      {loaded && entries.length > 0 && (
        <div className="total-bar">
          <div>
            <div className="lab">Total</div>
            <div className="val num">{formatNumber(totalPts)} pts</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/checkout', { state: { mode: 'cart' } })}>
            Review
          </button>
        </div>
      )}
    </div>
  );
}
