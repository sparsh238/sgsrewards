import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { formatNumber, formatRupees, formatDate } from '../../lib/format';
import { tierTargetLines, TIER_ACCENT, EARN_TIERS, type Tier } from '../../lib/tier';
import BillItems, { type LineItem } from '../../components/BillItems';
import Chevron from '../../components/Chevron';

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

  // Tier is the spine: recolor the whole header to its accent + rank on the ladder.
  const tierAccent = TIER_ACCENT[id.tier];
  const earnIdx = (EARN_TIERS as readonly Tier[]).indexOf(id.tier);
  const rankLabel = earnIdx >= 0 ? `tier ${earnIdx + 1} / ${EARN_TIERS.length}` : 'not enrolled';
  const tierLabel = id.tier === 'NoTier' ? 'No tier' : id.tier;

  // Hero rail: one shared 0→(highest threshold) scale so both the maintain notch
  // and the upgrade end-cap are visible on the same bar.
  const railLines = id.inScheme ? tierTargetLines(id.tier, q.floor, q.nextTier, q.nextReq) : [];
  const railMax = Math.max(q.billed, ...railLines.map((l) => l.need), 1);
  const railFill = Math.min(100, Math.round((q.billed / railMax) * 100));

  return (
    <div className="dcard" style={{ ['--tier' as string]: tierAccent }}>
      {/* Header band — tier-led */}
      <div className="dc-head">
        <div className="dc-medal">
          <div className="dc-medal-t">{tierLabel}</div>
          <div className="dc-medal-r">{rankLabel}</div>
        </div>
        <div className="dc-id">
          <div className="dc-name">{id.partyName}{!id.profileCompleted && <span className="pending dc-pend">profile pending</span>}</div>
          <div className="dc-idmeta">
            <span>{id.region || 'no area'}</span><span className="dc-dot" />
            {id.gstin ? <span className="t-mono">{id.gstin}</span> : <span className="pending">no GST</span>}<span className="dc-dot" />
            <span className="t-num">{id.phoneNumber || '—'}</span>
            <span className={`scheme-chip ${id.inScheme ? 'in' : 'out'}`}>{id.inScheme ? 'in-scheme' : 'redeem-only'}</span>
          </div>
          <span className={`dc-verdict ${verdict.cls}`}>{verdict.label} · {q.label}</span>
        </div>
        <div className="dc-heronum">
          <div className="dc-heronum-l">Points available</div>
          <div className="dc-heronum-v t-num">{formatNumber(id.availablePoints)}</div>
          <div className="dc-heronum-s t-num">{formatRupees(q.billed)} billed this quarter</div>
        </div>
      </div>

      {/* Hero rail — the tier's progress, promoted */}
      <div className="dc-rail">
        {!id.inScheme ? (
          <div className="dc-rail-none">Redeem-only dealer — bills earn no points, so there's no tier target.</div>
        ) : railLines.length === 0 ? (
          <div className="dc-rail-none">Top tier — nothing above to reach. Keep billing to hold {tierLabel}.</div>
        ) : (
          <>
            <div className="dc-rail-top">
              <span className="dc-rail-now t-num">{formatRupees(q.billed)} <small>billed toward {railLines[railLines.length - 1].tier}</small></span>
              <span className="dc-rail-q">where {q.label} puts the tier</span>
            </div>
            <div className="dc-hbar">
              <div className={`dc-hfill ${verdict.cls}`} style={{ width: `${railFill}%` }} />
              {railLines.map((ln, i) => {
                const pct = Math.min(100, Math.round((ln.need / railMax) * 100));
                const met = q.billed >= ln.need;
                return (
                  <div className={`dc-hmark${met ? ' met' : ''}`} key={i} style={{ left: `${pct}%`, ['--m' as string]: TIER_ACCENT[ln.tier] }}>
                    <span className="dc-hmark-l">{formatRupees(ln.need)}</span>
                  </div>
                );
              })}
            </div>
            <div className="dc-rail-legend">
              {railLines.map((ln, i) => {
                const met = q.billed >= ln.need;
                return (
                  <span className={`dc-leg${met ? ' met' : ''}`} key={i}>
                    <span className="dc-leg-dot" style={{ background: TIER_ACCENT[ln.tier] }} />
                    <b>{ln.verb} {ln.tier}</b>
                    <span className="dc-leg-f">{met ? '✓ cleared' : `${formatRupees(ln.need - q.billed)} short`}</span>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Supporting columns */}
      <div className="dcard-grid">
        <section className="dc-sec">
          <h4>Contact</h4>
          <dl className="dc-dl">
            <dt>Name</dt><dd>{contact || <span className="hint">not set</span>}</dd>
            <dt>Birthday</dt><dd>{dm(id.dateOfBirth)}</dd>
            <dt>Anniversary</dt><dd>{dm(id.anniversaryDate)}</dd>
          </dl>
        </section>

        <section className="dc-sec">
          <h4>{q.label}</h4>
          <dl className="dc-dl">
            <dt>Billed</dt><dd className="t-num">{formatRupees(q.billed)}</dd>
            <dt>Points earned</dt><dd className="t-num">{formatNumber(q.earned)}</dd>
            <dt>Bills</dt><dd className="t-num">{formatNumber(q.count)}</dd>
          </dl>
        </section>

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
                      <span className="t-mono">{hasItems && <Chevron open={open} sm />}{b.billNumber}</span>
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
