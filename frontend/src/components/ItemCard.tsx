import { type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IMAGE_BASE } from '../lib/api';
import { useCart } from '../lib/cart';
import { formatNumber, formatRupees } from '../lib/format';
import { isAvailable, itemPrice, type Item } from '../lib/types';

interface Props {
  item: Item;
  availablePoints: number | null;
  pointsConversion?: number;
}

export type RewardState = 'qualified' | 'goal' | 'unavailable';

/** Classify a reward against the dealer's balance. */
export function rewardState(item: Item, availablePoints: number | null): RewardState {
  if (!isAvailable(item)) return 'unavailable';
  if (availablePoints !== null && itemPrice(item) <= availablePoints) return 'qualified';
  return 'goal';
}

// Legacy helper kept for any screen still importing it.
export function redeemability(item: Item, availablePoints: number | null, pointsConversion: number) {
  if (!isAvailable(item)) return { cls: 'out', text: 'Currently unavailable' };
  if (availablePoints === null) return { cls: 'far', text: '' };
  const short = itemPrice(item) - availablePoints;
  if (short <= 0) return { cls: 'ok', text: '✓ You can redeem this' };
  if (pointsConversion > 0) return { cls: 'far', text: `${formatRupees(short * pointsConversion)} more billing needed` };
  return { cls: 'far', text: `${formatNumber(short)} more points needed` };
}

// Wide landscape reward card: image + details on top, actions on a full-width
// row below. Qualified = tier-coloured Add(→stepper)/Buy; Goal = red gap only;
// Unavailable = greyed & disabled.
export default function ItemCard({ item, availablePoints }: Props) {
  const price = itemPrice(item);
  const discount = item.discount ?? 0;
  const state = rewardState(item, availablePoints);
  const { qtyOf, add, setQty, pendingId } = useCart();
  const qty = qtyOf(item._id);
  const busy = pendingId === item._id;
  const navigate = useNavigate();

  const short = Math.max(0, price - (availablePoints ?? 0));
  const progress = price > 0 ? Math.min(100, Math.round(((availablePoints ?? 0) / price) * 100)) : 0;

  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <Link to={`/product/${item._id}`} className={`rcard ${state}`}>
      <div className="rcard-top">
        <div className="rcard-img">
          {item.images?.[0]
            ? <img src={`${IMAGE_BASE}/${item.images[0]}`} alt="" loading="lazy" />
            : <span className="rcard-noimg">{item.name.slice(0, 10)}</span>}
        </div>
        <div className="rcard-info">
          <div className="rcard-name">{item.name}</div>
          <div>
            <span className={`rcard-price${state === 'goal' ? ' goal' : ''} num`}>{formatNumber(price)} pts</span>
            {discount > 0 && <span className="rcard-strike num">{formatNumber(item.pointsRequired)}</span>}
          </div>
          {state === 'goal' && (
            <div className="rc-goalbar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          )}
        </div>
      </div>

      <div className="rcard-acts">
        {state === 'qualified' && (
          qty > 0 ? (
            <div className="rc-step">
              <button onClick={(e) => { stop(e); void setQty(item._id, qty - 1); }} disabled={busy} aria-label="Decrease quantity">−</button>
              <span className="q num">{qty}</span>
              <button onClick={(e) => { stop(e); void setQty(item._id, qty + 1); }} disabled={busy} aria-label="Increase quantity">＋</button>
            </div>
          ) : (
            <button className="rc-add" onClick={(e) => { stop(e); void add(item._id); }} disabled={busy}>＋ Add to cart</button>
          )
        )}
        {state === 'qualified' && (
          <button className="rc-buy" onClick={(e) => { stop(e); navigate('/checkout', { state: { mode: 'buynow', item } }); }}>Buy now</button>
        )}
        {state === 'goal' && <span className="rc-gap num">{formatNumber(short)} pts to go</span>}
        {state === 'unavailable' && <span className="rc-disabled">Currently unavailable</span>}
      </div>
    </Link>
  );
}
