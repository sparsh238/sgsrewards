import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { formatNumber, formatRupees, formatDate } from '../../lib/format';
import { tierTargetLines, type Tier } from '../../lib/tier';
import BillItems, { type LineItem } from '../../components/BillItems';

interface RecentBill {
  _id: string;
  billNumber: string;
  billDate: string;
  billAmount: number;
  pointsAwarded?: number;
  source?: string;
  locked?: boolean;
  excluded?: boolean;
  lineItems?: LineItem[];
}

interface Summary {
  identity: {
    partyName: string; firstName: string; lastName: string;
    phoneNumber: string; gstin: string; region: string;
    dateOfBirth: string | null; anniversaryDate: string | null;
    inScheme: boolean; profileCompleted: boolean;
    tier: Tier; availablePoints: number; totalPoints: number;
  };
  quarter: {
    label: string; billed: number; earned: number; count: number;
    floor: number; nextTier: Tier | null; nextReq: number | null;
    status: 'promoting' | 'holds' | 'atRisk'; rate: number | null;
  };
  lifetime: { billed: number; earned: number; count: number };
  recent: RecentBill[];
  redemptions: { count: number; points: number; recent: Redemption[] };
}

interface Redemption {
  _id: string;
  orderIdAlias: string;
  totalValue: number;
  orderDate: string;
  items: { itemId: { name?: string } | null; quantity: number }[];
}

const VERDICT: Record<Summary['quarter']['status'], { label: string; cls: string }> = {
  promoting: { label: 'On track to promote', cls: 'ok' },
  holds: { label: 'Holds tier', cls: 'hold' },
  atRisk: { label: 'At risk of drop', cls: 'risk' },
};

const dm = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function DealerCard({ userId }: { userId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [itemsOpen, setItemsOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiJson<Summary>(`/api/admin/users/${userId}/summary`)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [userId]);

  if (error) return <div className="dcard"><div className="error-banner" role="alert">{error}</div></div>;
  if (!data) return <div className="dcard"><div className="skeleton" style={{ height: 150 }} /></div>;

  const { identity: id, quarter: q, lifetime, recent } = data;
  const contact = [id.firstName, id.lastName].filter(Boolean).join(' ');
  const verdict = VERDICT[q.status];

  // Target bar: fill toward the next-tier requirement; the hold floor is a marker.
  // NoTier / top-tier fall back to the floor so the bar still means something.
  const target = q.nextReq ?? q.floor ?? 0;
  const fillPct = target > 0 ? Math.min(100, Math.round((q.billed / target) * 100)) : 0;
  const floorPct = target > 0 && q.floor > 0 && q.floor < target ? Math.round((q.floor / target) * 100) : null;
  const heldFloor = id.tier !== 'NoTier' && q.billed >= q.floor;

  return (
    <div className="dcard">
      <div className="dcard-grid">
        {/* Identity */}
        <section className="dc-sec">
          <h4>Contact</h4>
          <dl className="dc-dl">
            <dt>Name</dt><dd>{contact || <span className="hint">not set</span>}</dd>
            <dt>Phone</dt><dd className="t-num">{id.phoneNumber}</dd>
            <dt>GSTIN</dt><dd>{id.gstin ? <span className="t-mono">{id.gstin}</span> : <span className="pending">none</span>}</dd>
            <dt>Area</dt><dd>{id.region || '—'}</dd>
            <dt>Birthday</dt><dd>{dm(id.dateOfBirth)}</dd>
            <dt>Anniversary</dt><dd>{dm(id.anniversaryDate)}</dd>
          </dl>
          <div className="dc-tags">
            <span className={`scheme-chip ${id.inScheme ? 'in' : 'out'}`}>{id.inScheme ? 'in-scheme' : 'redeem-only'}</span>
            {!id.profileCompleted && <span className="pending">profile pending</span>}
          </div>
        </section>

        {/* This quarter */}
        <section className="dc-sec">
          <h4>{q.label} <span className={`dc-verdict ${verdict.cls}`}>{verdict.label}</span></h4>
          <div className="dc-bar-head">
            <b>{formatRupees(q.billed)}</b>
            <span className="hint">billed this quarter</span>
          </div>
          <div className="dc-bar">
            <div className={`dc-bar-fill ${verdict.cls}`} style={{ width: `${fillPct}%` }} />
            {floorPct != null && (
              <div className={`dc-bar-floor${heldFloor ? ' met' : ''}`} style={{ left: `${floorPct}%` }} title={`Hold ${id.tier}: ${formatRupees(q.floor)}`} />
            )}
          </div>
          <div className="dc-targets">
            {!id.inScheme ? (
              <div className="dc-trow hint">Redeem-only — earns no points</div>
            ) : (() => {
              const lines = tierTargetLines(id.tier, q.floor, q.nextTier, q.nextReq);
              if (lines.length === 0) return <div className="dc-trow met"><span>Top tier — nothing above to reach</span></div>;
              return lines.map((ln, i) => {
                const met = q.billed >= ln.need;
                return (
                  <div className={`dc-trow${met ? ' met' : ''}`} key={i}>
                    <span>{formatRupees(q.billed)} / {formatRupees(ln.need)} to {ln.verb} {ln.tier}</span>
                    <span className="dc-tflag">{met ? '✓ cleared' : `${formatRupees(ln.need - q.billed)} short`}</span>
                  </div>
                );
              });
            })()}
          </div>
          <dl className="dc-dl dc-mini">
            <dt>Earned this quarter</dt><dd className="t-num">{formatNumber(q.earned)}</dd>
            <dt>Bills this quarter</dt><dd className="t-num">{formatNumber(q.count)}</dd>
          </dl>
        </section>

        {/* Lifetime */}
        <section className="dc-sec">
          <h4>Lifetime</h4>
          <dl className="dc-dl">
            <dt>Total billed</dt><dd className="t-num">{formatRupees(lifetime.billed)}</dd>
            <dt>Points earned</dt><dd className="t-num">{formatNumber(lifetime.earned)}</dd>
            <dt>Bills recorded</dt><dd className="t-num">{formatNumber(lifetime.count)}</dd>
            <dt>Points available</dt><dd className="t-num t-strong">{formatNumber(id.availablePoints)}</dd>
            <dt>Points (all-time)</dt><dd className="t-num">{formatNumber(id.totalPoints)}</dd>
          </dl>
        </section>
      </div>

      {/* Recent bills — responsive list, tap a synced bill to see its items */}
      <div className="dc-recent">
        <h4>Recent bills</h4>
        {recent.length === 0 ? (
          <p className="hint">No bills recorded yet.</p>
        ) : (
          <div className="dc-list">
            {recent.map((b) => {
              const hasItems = (b.lineItems?.length ?? 0) > 0;
              const open = itemsOpen === b._id;
              return (
                <div className="dc-litem" key={b._id}>
                  <div className={`dc-lrow${hasItems ? ' tappable' : ''}`} onClick={hasItems ? () => setItemsOpen(open ? null : b._id) : undefined}>
                    <div className="dc-lmain">
                      <span className="t-mono">{hasItems && <span className={`row-caret${open ? ' open' : ''}`}>▸</span>}{b.billNumber}</span>
                      <span className="hint">{formatDate(b.billDate)}</span>
                    </div>
                    <div className="dc-lmeta">
                      <span className="t-num">{formatRupees(b.billAmount)}</span>
                      <span className="t-num">{b.pointsAwarded ? `+${formatNumber(b.pointsAwarded)}` : <span className="pending">+0</span>}</span>
                      {(b.source ?? 'manual') === 'busy'
                        ? <span className="src-tag busy">{b.locked ? 'synced · edited' : 'synced'}</span>
                        : <span className="src-tag">manual</span>}
                      {b.excluded && <span className="src-tag excl">excluded</span>}
                    </div>
                  </div>
                  {open && hasItems && <BillItems items={b.lineItems!} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Redemptions — fulfilled reward orders */}
      <div className="dc-recent">
        <h4>Redemptions {data.redemptions.count > 0 && <span className="hint">{formatNumber(data.redemptions.count)} · {formatNumber(data.redemptions.points)} pts spent</span>}</h4>
        {data.redemptions.recent.length === 0 ? (
          <p className="hint">No redemptions yet.</p>
        ) : (
          <div className="dc-list">
            {data.redemptions.recent.map((o) => (
              <div className="dc-lrow" key={o._id}>
                <div className="dc-lmain">
                  <span className="t-strong">{o.items[0]?.itemId?.name ?? 'Reward'}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}</span>
                  <span className="hint">{o.orderIdAlias} · {formatDate(o.orderDate)}</span>
                </div>
                <div className="dc-lmeta"><span className="t-num">−{formatNumber(o.totalValue)} pts</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
