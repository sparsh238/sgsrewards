import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { formatNumber, formatRupees, formatDate } from '../../lib/format';
import { type Tier } from '../../lib/tier';

interface RecentBill {
  _id: string;
  billNumber: string;
  billDate: string;
  billAmount: number;
  pointsAwarded?: number;
  source?: string;
  locked?: boolean;
  excluded?: boolean;
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
            <span className="hint">
              {q.nextReq != null && q.nextTier
                ? `of ${formatRupees(q.nextReq)} for ${q.nextTier}`
                : q.floor > 0 ? `of ${formatRupees(q.floor)} to hold ${id.tier}` : 'no target'}
            </span>
          </div>
          <div className="dc-bar">
            <div className={`dc-bar-fill ${verdict.cls}`} style={{ width: `${fillPct}%` }} />
            {floorPct != null && (
              <div className={`dc-bar-floor${heldFloor ? ' met' : ''}`} style={{ left: `${floorPct}%` }} title={`Hold ${id.tier}: ${formatRupees(q.floor)}`} />
            )}
          </div>
          <div className="dc-bar-legend hint">
            {id.inScheme
              ? (id.tier !== 'NoTier'
                  ? (heldFloor ? `Cleared the ${id.tier} hold line` : `Below the ${id.tier} hold line — ${formatRupees(Math.max(0, q.floor - q.billed))} short`)
                  : 'No tier yet this quarter')
              : 'Redeem-only — earns no points'}
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

      {/* Recent bills */}
      <div className="dc-recent">
        <h4>Recent bills</h4>
        {recent.length === 0 ? (
          <p className="hint">No bills recorded yet.</p>
        ) : (
          <table className="dc-bills">
            <tbody>
              {recent.map((b) => (
                <tr key={b._id}>
                  <td className="t-mono">{b.billNumber}</td>
                  <td className="hint">{formatDate(b.billDate)}</td>
                  <td className="t-num">{formatRupees(b.billAmount)}</td>
                  <td className="t-num">{b.pointsAwarded ? `+${formatNumber(b.pointsAwarded)}` : <span className="pending">+0</span>}</td>
                  <td>{(b.source ?? 'manual') === 'busy'
                    ? <span className="src-tag busy">{b.locked ? 'synced · edited' : 'synced'}</span>
                    : <span className="src-tag">manual</span>}{b.excluded && <span className="src-tag excl">excluded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
