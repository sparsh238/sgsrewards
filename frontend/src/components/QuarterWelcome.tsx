import { useNavigate } from 'react-router-dom';
import { formatNumber, formatRupees } from '../lib/format';
import {
  TIER_ORDER, nextTierOf, quarterLabel,
  type PointsConversions, type Tier, type TierRequirements,
} from '../lib/tier';
import MetalCard from './MetalCard';

type Outcome = 'promoted' | 'held' | 'dropped' | 'first';

interface Props {
  tier: Tier;                 // new tier this quarter
  prevTier: Tier;             // tier last quarter
  partyName: string;
  earnRates: PointsConversions;
  requirements: TierRequirements;
  onDismiss: () => void;
}

const rank = (t: Tier) => TIER_ORDER.indexOf(t);

function outcomeOf(tier: Tier, prevTier: Tier): Outcome {
  if (prevTier === 'NoTier' && tier !== 'NoTier') return 'first';
  if (rank(tier) > rank(prevTier)) return 'promoted';
  if (rank(tier) < rank(prevTier)) return 'dropped';
  return 'held';
}

const BURST: Record<Outcome, string> = { promoted: '🎉', held: '🛡', dropped: '🔻', first: '✨' };

export default function QuarterWelcome({ tier, prevTier, partyName, earnRates, requirements, onDismiss }: Props) {
  const navigate = useNavigate();
  const outcome = outcomeOf(tier, prevTier);

  const headline = {
    promoted: <>You've been promoted to <span className="acc">{tier}</span></>,
    held: <><span className="acc">{tier}</span> held for another quarter</>,
    dropped: <>Your tier moved to <span className="acc">{tier}</span></>,
    first: <>Welcome to <span className="acc">{tier}</span></>,
  }[outcome];

  const sub = {
    promoted: 'Your billing last quarter took you up a tier — and your points now stack faster.',
    held: 'You stayed above the line last quarter — same earn rate, keep it rolling.',
    dropped: 'Billing dipped below the line — your earn rate eased back. Here’s the way up.',
    first: 'You’ve crossed into your first tier — you now earn points on every bill.',
  }[outcome];

  const arrowCls = outcome === 'dropped' ? 'down' : outcome === 'held' ? 'same' : 'up';
  const arrow = outcome === 'dropped' ? '↓' : outcome === 'held' ? '→' : '↑';

  // Earn rate = ₹ of billing per 1 point; lower is better.
  const newRate = earnRates[tier];
  const oldRate = outcome === 'first' ? undefined : earnRates[prevTier];
  const rateTag = { promoted: '↑ faster', held: 'unchanged', dropped: '↓ slower', first: 'now earning' }[outcome];
  const rateTagCls = outcome === 'dropped' ? 'down' : outcome === 'held' ? 'same' : 'up';

  const next = nextTierOf(tier);
  const keepReq = requirements[tier];
  const nextReq = next ? requirements[next] : undefined;
  const recoverReq = requirements[prevTier];

  // The climb / keep targets are already shown on this modal, so every CTA just
  // moves on to the shop — labels are worded to match that single destination.
  const cta = { promoted: `Explore ${tier} rewards`, held: 'Continue', dropped: 'Browse rewards', first: 'Explore rewards' }[outcome];
  const go = () => { onDismiss(); navigate('/shop'); };

  return (
    <div className="qw-overlay" role="dialog" aria-modal="true" aria-label="Quarterly tier update">
      <div className="qw-glow" aria-hidden="true" />
      <div className="qw-body">
        <div className="qw-qtag">{quarterLabel()} opens</div>
        <div className="qw-burst" aria-hidden="true">{BURST[outcome]}</div>
        <div className="qw-headline">{headline}</div>
        <div className="qw-sub">{sub}</div>

        <MetalCard tier={tier} partyName={partyName} />

        <div className="qw-delta">
          <span className="from">{prevTier === 'NoTier' ? 'No Tier' : prevTier}</span>
          <span className={`arr ${arrowCls}`} aria-hidden="true">{arrow}</span>
          <span className="to">{tier}</span>
        </div>

        {newRate !== undefined && (
          <div className="qw-rate">
            <span className="rl">⚡ Earn rate</span>
            <span className="rr">
              {oldRate !== undefined && <span className="old num">₹{formatNumber(oldRate)}</span>}
              {oldRate !== undefined && <span className={`arrc ${rateTagCls}`} aria-hidden="true">→</span>}
              {outcome === 'first' && <span className="old">—</span>}
              {outcome === 'first' && <span className="arrc up" aria-hidden="true">→</span>}
              <span className="new num">₹{formatNumber(newRate)}</span>
              <span className="unit">= 1 pt</span>
              <span className={`qw-rate-tag ${rateTagCls}`}>{rateTag}</span>
            </span>
          </div>
        )}

        <div className="qw-targets">
          {outcome === 'dropped' && recoverReq !== undefined && (
            <div className="qw-tgt recover">
              <div className="tgt-top"><span className="l">↩ Climb back to {prevTier}</span><span className="v num">{formatRupees(recoverReq)}</span></div>
              <div className="tgt-note">Bill this much this quarter to regain {prevTier}{oldRate !== undefined ? ` & the ₹${formatNumber(oldRate)} rate` : ''}.</div>
            </div>
          )}
          {keepReq !== undefined && (
            <div className="qw-tgt defend">
              <div className="tgt-top"><span className="l">🛡 Keep {tier}</span><span className="v num">{formatRupees(keepReq)}</span></div>
              {outcome !== 'dropped' && <div className="tgt-note">Bill this much this quarter to stay {tier}.</div>}
            </div>
          )}
          {outcome !== 'dropped' && next && nextReq !== undefined && (
            <div className="qw-tgt advance">
              <div className="tgt-top"><span className="l">⬆ Reach {next}</span><span className="v num">{formatRupees(nextReq)}</span></div>
            </div>
          )}
        </div>

        <button className="qw-cta" onClick={go}>{cta}</button>
        <button className="qw-dismiss" onClick={onDismiss}>Maybe later</button>
      </div>
    </div>
  );
}
