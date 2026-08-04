import type { Tier } from '../lib/tier';

// The dealer's tier rendered as a metal membership card. The metal (gradient,
// ink, sheen) comes from the tier tokens on the frame, so this just consumes the
// CSS vars. No Tier is a flat, dashed "not a member yet" card.
interface Props {
  tier: Tier;
  partyName: string;
  memberSince?: string;
}

export default function MetalCard({ tier, partyName, memberSince }: Props) {
  const noTier = tier === 'NoTier';
  const label = noTier ? 'Not a tier member yet' : `${tier} member`;

  return (
    <div className={`metal-card${noTier ? ' notier' : ''}`}>
      {noTier ? <div className="mc-lock" aria-hidden="true">🔒</div> : <div className="mc-chip" />}
      <div className="mc-tier">{label}</div>
      <div className="mc-name">{partyName}</div>
      <div className="mc-meta">
        <span>SGS Rewards</span>
        <span>{memberSince ?? ''}</span>
      </div>
    </div>
  );
}
