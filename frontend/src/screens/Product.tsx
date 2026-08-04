import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiJson, IMAGE_BASE } from '../lib/api';
import { formatNumber, formatRupees } from '../lib/format';
import { useToast } from '../lib/toast';
import { useCart } from '../lib/cart';
import { itemPrice, type Item } from '../lib/types';
import { htmlToText } from '../lib/html';
import { rewardState } from '../components/ItemCard';
import { useDealerTier } from '../lib/tierTheme';
import AppBar from '../components/AppBar';

export default function Product() {
  const { id } = useParams<{ id: string }>();
  const tier = useDealerTier();
  const [item, setItem] = useState<Item | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  // Per-tier earn rates (₹ of billing per point). The billing hints must use
  // the DEALER'S CURRENT TIER rate, not a flat conversion — a Basic dealer
  // needs far more billing per point than a Platinum one.
  const [rates, setRates] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const { addQty, pendingId } = useCart();
  const { toast, toastError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [it, pts, conv] = await Promise.all([
          apiJson<Item>(`/api/item/itm/${id}`),
          apiJson<{ availablePoints: number }>('/api/user/points'),
          apiJson<{ tierPointsConversion: Record<string, number> }>('/api/superadmin/system/points-conversion'),
        ]);
        if (cancelled) return;
        setItem(it);
        setPoints(pts.availablePoints);
        setRates(conv.tierPointsConversion || {});
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="page"><AppBar title="Reward" /><div className="error-banner" role="alert">{error}</div></div>;
  if (!item) return <div className="page"><AppBar title="Reward" /><div className="skeleton" style={{ height: 200 }} /></div>;

  const price = itemPrice(item);
  const discount = item.discount ?? 0;
  const pct = discount > 0 ? Math.round((discount / item.pointsRequired) * 100) : 0;
  const state = rewardState(item, points);
  const short = Math.max(0, price - (points ?? 0));
  const progress = price > 0 ? Math.min(100, Math.round(((points ?? 0) / price) * 100)) : 0;
  const desc = htmlToText(item.description);
  const images = item.images ?? [];
  const busy = pendingId === item._id;
  // ₹ of billing behind one point at THIS dealer's tier (0 for NoTier — earns nothing).
  const rate = tier ? (rates[tier] ?? 0) : 0;

  const addToCart = async () => {
    try {
      await addQty(item._id, qty);
      toast(`${qty} × "${item.name}" added to cart`);
    } catch (err) {
      toastError((err as Error).message);
    }
  };
  const buyNow = () => navigate('/checkout', { state: { mode: 'buynow', item, quantity: qty } });

  return (
    <div className="page">
      <AppBar
        title="Reward"
        fallback="/shop"
        right={<span className="ab-pts num">{points === null ? '' : `${formatNumber(points)} pts`}</span>}
      />

      <div className="product-hero">
        {images[img]
          ? <img src={`${IMAGE_BASE}/${images[img]}`} alt={item.name} />
          : <span className="no-img">{item.name}</span>}
        {images.length > 1 && (
          <>
            <span className="hero-count num">{img + 1} / {images.length}</span>
            <div className="hero-dots">
              {images.map((_, i) => (
                <button
                  key={i}
                  className={`hero-dot${i === img ? ' on' : ''}`}
                  aria-label={`Image ${i + 1}`}
                  onClick={() => setImg(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {state === 'qualified' && <span className="status-chip qual">✓ Qualified · you can redeem</span>}
      {state === 'goal' && <span className="status-chip goal">◆ Goal · keep saving</span>}
      {state === 'unavailable' && <span className="status-chip out">Currently unavailable</span>}

      <div>
        <h1 className="product-name">{item.name}</h1>
        <div className="product-price-row">
          <span className={`product-pts num${state === 'goal' ? ' goal' : ''}`}>{formatNumber(price)} pts</span>
          {discount > 0 && <span className="item-strike num">{formatNumber(item.pointsRequired)}</span>}
          {pct > 0 && <span className="save-chip num">SAVE {pct}%</span>}
        </div>
        {rate > 0 && state !== 'goal' && (
          <p className="billing-worth num">≈ {formatRupees(price * rate)} billing value at your tier</p>
        )}
        {rate > 0 && state === 'goal' && (
          <p className="billing-need num">Bill <b>{formatRupees(short * rate)}</b> more to unlock this</p>
        )}
      </div>

      {/* Actions / target sit ABOVE the description so they're reachable without scrolling. */}
      {state === 'qualified' && (
        <>
          <div className="qty-row">
            <span className="qty-lab">Quantity</span>
            <div className="qty-step">
              <button aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="q num">{qty}</span>
              <button aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>＋</button>
            </div>
          </div>
          <div className="actions-row">
            <button className="btn btn-ghost" onClick={addToCart} disabled={busy}>＋ Add to cart</button>
            <button className="btn btn-primary" onClick={buyNow}>Buy now</button>
          </div>
        </>
      )}

      {state === 'goal' && (
        <>
          <div className="goal-panel">
            <div className="rc-goalbar"><span style={{ width: `${progress}%` }} /></div>
            <div className="goal-gap num">{formatNumber(short)} pts to go</div>
            <div className="goal-note num">
              You're at <b>{formatNumber(points ?? 0)} / {formatNumber(price)}</b>. Keep billing — it unlocks automatically.
            </div>
          </div>
          <div className="locked-cta num">🔒 {formatNumber(short)} pts to go</div>
        </>
      )}

      {state === 'unavailable' && <div className="locked-cta">Currently unavailable</div>}

      {desc && (
        <div className="desc-block">
          <div className="section-label">Description</div>
          <p className="product-desc">{desc}</p>
        </div>
      )}
    </div>
  );
}
