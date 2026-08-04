import { useEffect, useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { formatNumber } from '../lib/format';
import type { Order } from '../lib/types';

export default function OrderPlaced() {
  const location = useLocation();
  const order = (location.state as { order?: Order } | null)?.order;
  // Fresh from the server — never trust pre-order math for the new balance.
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ availablePoints: number }>('/api/user/points')
      .then((p) => { if (!cancelled) setPoints(p.availablePoints); })
      .catch(() => { /* balance shows on Home anyway */ });
    return () => { cancelled = true; };
  }, []);

  if (!order) return <Navigate to="/home" replace />;

  return (
    <div className="page" style={{ justifyContent: 'center', textAlign: 'center', gap: 20 }}>
      <div className="success-ring" aria-hidden="true">✓</div>
      <div>
        <h1 className="page-title">Order placed!</h1>
        <p className="page-sub" style={{ marginTop: 6 }}>
          Order <b className="num" style={{ color: 'var(--copper-hi)' }}>{order.orderIdAlias}</b> ·{' '}
          <span className="num">{formatNumber(order.totalValue)} pts</span>
        </p>
        {points !== null && (
          <p className="page-sub" style={{ marginTop: 4 }}>
            Balance: <b className="num" style={{ color: 'var(--ink)' }}>{formatNumber(points)} pts</b>
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/profile" className="btn btn-primary">View my orders</Link>
        <Link to="/shop" className="btn btn-ghost">Back to shop</Link>
      </div>
    </div>
  );
}
