import { formatRupees } from '../lib/format';
import type { Nudge } from '../lib/tier';
import Gauge from './Gauge';

// Home billing nudge: Defend (semicircle gauge) + Advance (linear bar) + weekly.
// Both jobs shown together; the out-of-scheme floor takes over for NoTier.
export default function TierNudge({ nudge, onOpen }: { nudge: Nudge; onOpen: () => void }) {
  const { state, billed, daysLeft, currentTier } = nudge;

  const daysChip = (
    <span className={`chip ${state === 'risk' ? 'chip-risk' : state === 'notier' ? 'chip-risk' : 'chip-ok'}`}>
      {state === 'safe' || state === 'top' ? 'on track' : <>⏳ <span className="num">{daysLeft}</span> days left</>}
    </span>
  );

  // ---- NoTier: either qualified-and-pending-enrolment, or genuinely below the floor ----
  if (state === 'notier') {
    // Billing this quarter already clears the Basic floor → they've QUALIFIED and
    // will be enrolled at the next quarter review. Don't say "below the minimum".
    const qualified = nudge.reentryReq !== null && billed >= nudge.reentryReq;
    return (
      <button className="card tap-card nudge" onClick={onOpen} aria-label="View your tier">
        <div className={`out-box${qualified ? ' in' : ''}`}>
          {qualified ? (
            <>
              <div className="out-title in">🎉 You've qualified{nudge.securedTier ? ` for ${nudge.securedTier}` : ''}!</div>
              <div className="out-sub num">
                {formatRupees(billed)} billed this quarter — you'll be enrolled{nudge.securedTier ? ` at ${nudge.securedTier}` : ''} at the next quarter review.
              </div>
            </>
          ) : (
            <>
              <div className="out-title">⚠️ You're out of the rewards scheme</div>
              <div className="out-sub num">
                Only {formatRupees(billed)} billed this quarter{nudge.reentryReq !== null && <> — below the {formatRupees(nudge.reentryReq)} Basic minimum</>}.
              </div>
            </>
          )}
        </div>
        {!qualified && nudge.reentryReq !== null && (
          <div className="adv">
            <div className="adv-top">
              <span className="adv-name">↩ Get in at Basic</span>
              <span className="adv-need num">{formatRupees(nudge.toReenter)} to go</span>
            </div>
            <div className="adv-track"><span style={{ width: `${nudge.reentryReq ? Math.min(100, (billed / nudge.reentryReq) * 100) : 0}%` }} /></div>
            <div className="adv-note">Reach the Basic minimum to start earning.</div>
          </div>
        )}
        {weekly(nudge)}
      </button>
    );
  }

  const gaugeVariant = nudge.gaugeSecured ? 'green' : 'risk';
  const defendLabel = nudge.gaugeSecured
    ? `billed · ${currentTier} held`
    : nudge.keepReq !== null
      ? `of ${formatRupees(nudge.keepReq)} to keep ${currentTier}`
      : '';

  return (
    <button className="card tap-card nudge" onClick={onOpen} aria-label="View your tier">
      <div className="spread">
        <span className={`defend-head ${nudge.gaugeSecured ? 'ok' : 'risk'}`}>
          {nudge.gaugeSecured ? `🛡 ${currentTier} secured ✓` : `🛡 Defend ${currentTier}`}
        </span>
        {daysChip}
      </div>

      <Gauge
        frac={nudge.gaugeFrac}
        value={billed}
        max={1}
        centerBig={formatRupees(billed)}
        centerSmall={defendLabel}
        variant={gaugeVariant}
      />

      {/* Loss line — only when at risk */}
      {state === 'risk' && (
        <div className="loss-line">
          Bill <b className="r num">{formatRupees(nudge.toKeep)}</b> more or you drop to{' '}
          <b>{nudge.dropTo === 'out' ? 'out of the scheme' : nudge.dropTo}</b>.
        </div>
      )}

      {/* Advance bar — the single next rung (hidden for top tier) */}
      {nudge.advanceTier && (
        <div className="adv">
          <div className="adv-top">
            <span className="adv-name">⬆ Advance to {nudge.advanceTier}</span>
            <span className="adv-need num">{formatRupees(nudge.toNext)} to go</span>
          </div>
          <div className="adv-track"><span style={{ width: `${nudge.advanceFrac * 100}%` }} /></div>
          {nudge.nextRate && nudge.currentRate && (
            <div className="adv-note">
              Earn faster: <b className="num">₹{nudge.nextRate} = 1pt</b>{' '}
              <span className="was num">(now ₹{nudge.currentRate})</span>
            </div>
          )}
        </div>
      )}

      {weekly(nudge)}
    </button>
  );
}

function weekly(nudge: Nudge) {
  if (!(nudge.weeklyTarget > 0) || !nudge.weeklyGoal.tier) return null;
  const { verb, tier } = nudge.weeklyGoal;
  const label = verb === 'defend' ? `to defend ${tier}` : verb === 'reach' ? `to reach ${tier}` : 'to re-enter';
  return (
    <div className="weekly">
      <span className="w-lab">Weekly pace {label}</span>
      <span className="w-val num">{formatRupees(nudge.weeklyTarget)}</span>
    </div>
  );
}
