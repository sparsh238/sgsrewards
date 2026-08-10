import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { TIER_ACCENT, type Tier } from '../../lib/tier';
import SearchInput from '../../components/SearchInput';
import DealerCard from './DealerCard';
import { matchesSearch } from '../../lib/search';

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

  // Filters — the review list can be 100+ rows, so let the admin narrow by area,
  // direction (promotion / demotion / new entrant) and name. Filtering never
  // changes what's selected: `checked` persists across filters, so "Approve N"
  // still applies every ticked dealer, on-screen or not.
  const [regionF, setRegionF] = useState('All');
  const [dirF, setDirF] = useState<'all' | 'up' | 'down' | 'new'>('all');
  const [q, setQ] = useState('');
  const [dealerOpen, setDealerOpen] = useState<string | null>(null);

  const load = () => {
    setReview(null);
    apiJson<Review>('/api/superadmin/tier-review')
      .then((r) => { setReview(r); setChecked(Object.fromEntries(r.changes.map((c) => [c.userId, true]))); })
      .catch((e) => setError((e as Error).message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const selectedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);

  const regions = useMemo(
    () => [...new Set((review?.changes ?? []).map((c) => c.region).filter(Boolean) as string[])].sort(),
    [review],
  );
  const visible = useMemo(() => {
    const list = review?.changes ?? [];
    return list.filter((c) => {
      if (regionF !== 'All' && (c.region || '') !== regionF) return false;
      if (dirF === 'new' && !c.isNewEntrant) return false;
      if (dirF === 'up' && (c.isNewEntrant || c.direction !== 'up')) return false;
      if (dirF === 'down' && c.direction !== 'down') return false;
      if (q.trim() && !matchesSearch(c.partyName, q)) return false;
      return true;
    });
  }, [review, regionF, dirF, q]);
  // "Select all" acts on the VISIBLE rows only, and reads as on when they're all ticked.
  const visibleAllOn = visible.length > 0 && visible.every((c) => checked[c.userId]);
  const filtered = review ? visible.length !== review.changes.length : false;

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
          <div className="chip-row" style={{ gap: 10, marginBottom: 14 }}>
            {regions.length > 0 && (
              <select className="input" style={{ width: 'auto' }} value={regionF} onChange={(e) => setRegionF(e.target.value)}>
                <option value="All">All areas</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <button className={`fchip${dirF === 'all' ? ' on' : ''}`} onClick={() => setDirF('all')}>All <b className="fc-n">{review.counts.changes}</b></button>
            <button className={`fchip${dirF === 'up' ? ' on' : ''}`} onClick={() => setDirF('up')}>▲ Promoted <b className="fc-n">{review.counts.up}</b></button>
            <button className={`fchip${dirF === 'down' ? ' on' : ''}`} onClick={() => setDirF('down')}>▼ Dropped <b className="fc-n">{review.counts.down}</b></button>
            <button className={`fchip${dirF === 'new' ? ' on' : ''}`} onClick={() => setDirF('new')}>New <b className="fc-n">{review.counts.newEntrants}</b></button>
            <SearchInput value={q} onChange={setQ} placeholder="Search dealer…" style={{ width: 'auto', flex: '1 1 160px', maxWidth: 240 }} />
            {(regionF !== 'All' || dirF !== 'all' || q) && (
              <button className="fchip" onClick={() => { setRegionF('All'); setDirF('all'); setQ(''); }}>Clear</button>
            )}
          </div>

          <div className="tr-summary">
            <span className="tr-counts">
              {filtered ? `${visible.length} of ${review.counts.changes} shown` : `${review.counts.changes} changes`} · {review.counts.up} up · {review.counts.down} down · {review.counts.newEntrants} new · <b>{selectedCount} selected</b>
            </span>
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
                      <input type="checkbox" className="trow-check" checked={visibleAllOn}
                        aria-label="Select all shown"
                        onChange={(e) => setChecked((m) => ({ ...m, ...Object.fromEntries(visible.map((c) => [c.userId, e.target.checked])) }))} />
                    </th>
                    <th>Dealer</th><th>Region</th><th>Billed</th>
                    <th style={{ textAlign: 'right' }}>Current</th><th className="tr-arrow">→</th><th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr><td colSpan={7} className="hint" style={{ textAlign: 'center', padding: 30 }}>No dealers match these filters.</td></tr>
                  )}
                  {visible.map((c) => (
                    <Fragment key={c.userId}>
                    <tr>
                      <td><input type="checkbox" className="trow-check" checked={!!checked[c.userId]}
                        onChange={(e) => setChecked((m) => ({ ...m, [c.userId]: e.target.checked }))} /></td>
                      <td className="t-strong"><button className="linklike" onClick={() => setDealerOpen(dealerOpen === c.userId ? null : c.userId)}>{c.partyName}</button></td>
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
                    {dealerOpen === c.userId && (
                      <tr className="row-detail"><td colSpan={7}><DealerCard userId={c.userId} /></td></tr>
                    )}
                    </Fragment>
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
