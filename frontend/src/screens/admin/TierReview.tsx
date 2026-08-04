import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { TIER_ACCENT, type Tier } from '../../lib/tier';

interface Change {
  userId: string;
  partyName: string;
  region?: string;
  billed: number;
  currentTier: Tier;
  proposedTier: Tier;
  direction: 'up' | 'down' | 'hold';
  isNewEntrant: boolean;
}
interface Review {
  from: string; to: string;
  quarterLabel: string; fyLabel: string;
  alreadyApplied: boolean; appliedAt: string | null;
  counts: { changes: number; up: number; down: number; newEntrants: number };
  changes: Change[];
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const TierChip = ({ t }: { t: Tier }) => (
  <span className="tier-chip" style={{ color: TIER_ACCENT[t] }}>{t === 'NoTier' ? 'NoTier' : `◆ ${t}`}</span>
);

export default function TierReview() {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const { toast, toastError } = useToast();

  const load = () => {
    setReview(null);
    apiJson<Review>('/api/superadmin/tier-review')
      .then((r) => { setReview(r); setChecked(Object.fromEntries(r.changes.map((c) => [c.userId, true]))); })
      .catch((e) => setError((e as Error).message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const selectedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const allOn = review ? selectedCount === review.changes.length && review.changes.length > 0 : false;

  const apply = async (force = false) => {
    if (!review) return;
    if (force && !window.confirm(`Recompute and re-apply the tier review for ${review.quarterLabel}? It runs on the same quarter's billing, so the result won't change unless bills were edited.`)) return;
    const changes = review.changes.filter((c) => checked[c.userId]).map((c) => ({ userId: c.userId, proposedTier: c.proposedTier }));
    if (changes.length === 0) { toastError('Select at least one dealer.'); return; }
    setApplying(true);
    try {
      const res = await apiJson<{ applied: number }>('/api/superadmin/tier-review/apply', { method: 'POST', json: { changes, force } });
      toast(`${res.applied} tier change${res.applied === 1 ? '' : 's'} applied`);
      load();
    } catch (err) { toastError((err as Error).message); }
    finally { setApplying(false); }
  };

  const fmtL = (n: number) => `₹${(n / 1e5).toFixed(2)}L`;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Quarterly Tier Review{review ? ` — ${review.quarterLabel}` : ''}</h1>
          <p className="page-sub">
            {review ? `Computed from ${review.quarterLabel} billing (${fmtDate(review.from)}–${fmtDate(review.to)}). ` : ''}
            Nothing applies until you approve.
          </p>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {review === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {review && (
        <>
          {review.alreadyApplied && (
            <div className="tr-applied">
              ✓ <b>{review.quarterLabel}</b> tier review was already applied{review.appliedAt ? ` on ${fmtDate(review.appliedAt)}` : ''}.
              Running once per quarter is the norm — recompute only if you edited this quarter's bills.
            </div>
          )}
          <div className="tr-summary">
            <span className="tr-counts">{review.counts.changes} changes · {review.counts.up} up · {review.counts.down} down · {review.counts.newEntrants} new</span>
            {review.alreadyApplied ? (
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '9px 16px' }} onClick={() => apply(true)} disabled={applying || selectedCount === 0}>
                {applying ? 'Applying…' : `↻ Recompute & re-apply ${selectedCount}`}
              </button>
            ) : (
              <button className="btn btn-primary" style={{ width: 'auto', padding: '9px 16px' }} onClick={() => apply(false)} disabled={applying || selectedCount === 0}>
                {applying ? 'Applying…' : `✓ Approve ${selectedCount} & apply`}
              </button>
            )}
          </div>

          {review.changes.length === 0 ? (
            <div className="empty"><b>No tier changes</b><span>Every dealer is where the billing puts them.</span></div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>
                      <input type="checkbox" className="trow-check" checked={allOn}
                        onChange={(e) => setChecked(Object.fromEntries(review.changes.map((c) => [c.userId, e.target.checked])))} />
                    </th>
                    <th>Dealer</th><th>Region</th><th>Billed</th>
                    <th style={{ textAlign: 'right' }}>Current</th><th className="tr-arrow">→</th><th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {review.changes.map((c) => (
                    <tr key={c.userId}>
                      <td><input type="checkbox" className="trow-check" checked={!!checked[c.userId]}
                        onChange={(e) => setChecked((m) => ({ ...m, [c.userId]: e.target.checked }))} /></td>
                      <td className="t-strong">{c.partyName}</td>
                      <td className="hint">{c.region || '—'}</td>
                      <td className="t-num">{fmtL(c.billed)}</td>
                      <td style={{ textAlign: 'right' }}><TierChip t={c.currentTier} /></td>
                      <td className="tr-arrow">→</td>
                      <td>
                        <TierChip t={c.proposedTier} />
                        <span className={`mv ${c.isNewEntrant ? 'new' : c.direction}`}>
                          {c.isNewEntrant ? 'new entrant' : c.direction === 'up' ? '▲ up' : '▼ down'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
