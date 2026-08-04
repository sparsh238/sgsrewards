import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { formatNumber, formatRupees } from '../lib/format';
import {
  computeNudge, tierLadder, quarterLabel, thisQuarter,
  type Bill, type Nudge, type PointsConversions, type Rung, type Tier, type TierRequirements,
} from '../lib/tier';
import Gauge from '../components/Gauge';

const MEDALS: Record<Exclude<Tier, 'NoTier'>, string> = {
  Basic: 'linear-gradient(135deg, #AEB6C2, #7E8896)',
  Bronze: 'linear-gradient(135deg, #C98A52, #8F5A2E)',
  Silver: 'linear-gradient(135deg, #D8DDE2, #9BA4AD)',
  Gold: 'linear-gradient(135deg, #F1D488, #C69B3D)',
  Platinum: 'linear-gradient(135deg, #EDF1F7, #B9C4D2)',
};

export default function TierPage() {
  const [rungs, setRungs] = useState<Rung[] | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [quarter, setQuarter] = useState<{ billed: number; earned: number } | null>(null);
  const [outOfScheme, setOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prof, bills, reqs, conv] = await Promise.all([
          apiJson<{ tier: Tier }>('/api/user/profile'),
          apiJson<Bill[]>('/api/bill/user'),
          apiJson<{ tierBillingRequirements: TierRequirements }>('/api/superadmin/system/tier-billing-requirements'),
          apiJson<{ tierPointsConversion: PointsConversions }>('/api/superadmin/system/points-conversion'),
        ]);
        if (cancelled) return;
        const requirements = reqs.tierBillingRequirements || {};
        const conversions = conv.tierPointsConversion || {};
        const ladder = tierLadder(prof.tier, bills, requirements, conversions);
        setRungs(ladder.rungs);
        setOut(ladder.outOfScheme);
        setNudge(computeNudge(prof.tier, bills, requirements, conversions));
        setQuarter(thisQuarter(bills));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Your climb</h1>
        <p className="page-sub">{quarterLabel()}</p>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {rungs === null && !error && <div className="skeleton" style={{ height: 340 }} />}

      {/* Current status — same Defend gauge as Home */}
      {nudge && nudge.state !== 'notier' && (
        <div className="card">
          <div className="spread">
            <span className={`defend-head ${nudge.gaugeSecured ? 'ok' : 'risk'}`}>
              {nudge.gaugeSecured ? `🛡 ${nudge.currentTier} secured ✓` : `🛡 Defend ${nudge.currentTier}`}
            </span>
            <span className={`chip ${nudge.gaugeSecured ? 'chip-ok' : 'chip-risk'}`}>
              {nudge.gaugeSecured ? 'on track' : <>⏳ <span className="num">{nudge.daysLeft}</span> days left</>}
            </span>
          </div>
          <Gauge
            frac={nudge.gaugeFrac}
            value={nudge.billed}
            max={1}
            centerBig={formatRupees(nudge.billed)}
            centerSmall={nudge.gaugeSecured
              ? `billed · ${nudge.currentTier} held`
              : nudge.keepReq !== null ? `of ${formatRupees(nudge.keepReq)} to keep ${nudge.currentTier}` : ''}
            variant={nudge.gaugeSecured ? 'green' : 'risk'}
          />
        </div>
      )}

      {/* This-quarter recap */}
      {nudge && quarter && (
        <div className="month-grid stat3">
          <div className="month-stat">
            <div className="ms-val num" style={{ fontSize: 18 }}>{formatRupees(quarter.billed)}</div>
            <div className="ms-lab">billed</div>
          </div>
          <div className="month-stat">
            <div className="ms-val num accent" style={{ fontSize: 18 }}>{formatNumber(quarter.earned)}</div>
            <div className="ms-lab">pts earned</div>
          </div>
          <div className="month-stat">
            <div className="ms-val num" style={{ fontSize: 18 }}>{nudge.daysLeft}</div>
            <div className="ms-lab">days left</div>
          </div>
        </div>
      )}

      {rungs && (
        <div className="card" style={{ padding: '14px' }}>
          <div className="ladder">
            {rungs.map((r, i) => (
              <div key={r.tier}>
                <div className={`rung-l ${r.status}${r.isCurrent ? ' current' : ''}`}>
                  <div className="medal" style={{ background: MEDALS[r.tier] }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="r-name">
                      {r.tier}
                      {r.isCurrent && <span className="youdot">YOU NOW</span>}
                    </div>
                    <div className="r-sub num">
                      {r.requirement !== null ? formatRupees(r.requirement) : '—'}
                      {r.rate ? ` · earn ₹${r.rate}=1pt` : ''}
                    </div>
                  </div>
                  <div className="r-right num">
                    {r.status === 'crossed'
                      ? (r.isCurrent ? '✓ held' : '✓')
                      : r.status === 'defend'
                        ? `${formatRupees(r.toClimb)} to keep ▼`
                        : r.status === 'next'
                          ? `${formatRupees(r.toClimb)} to climb ▲`
                          : `${formatRupees(r.toClimb)} away`}
                  </div>
                </div>
                {i < rungs.length - 1 && <div className="rung-connect" />}
              </div>
            ))}
          </div>
          <div className={`floor-strip${outOfScheme ? ' active' : ''}`}>
            ▼ Below {rungs.length ? formatRupees(rungs[rungs.length - 1].requirement ?? 0) : ''} = out of the scheme
            {outOfScheme ? " · you're out" : " · you're clear"}
          </div>
        </div>
      )}
    </div>
  );
}
