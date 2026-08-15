// Daily Spin-the-Wheel config + helpers. Points-only prizes, one spin per
// calendar day (IST), 10-pt entry, eligible for Basic tier and up (No Tier
// excluded). The prize weights set the economics — this "Neutral" table pays
// out ≈ the entry fee on average (near-zero net points liability), with a rare
// jackpot for the thrill. Dealers never see the weights.
export interface SpinSegment { label: string; points: number; weight: number }

export const SPIN = {
  enabled: true,
  entryFee: 10,
  // Ladder rank required to play (NoTier = 0). 1 = Basic and up.
  minTierRank: 1,
  // 8 slices (rendered as an 8-segment wheel). Order here = clockwise order on
  // the wheel; two "Better luck" slices so the common outcome isn't one lonely wedge.
  segments: [
    { label: 'Better luck', points: 0,    weight: 28 },
    { label: '5 points',    points: 5,    weight: 22 },
    { label: 'Better luck', points: 0,    weight: 27 },
    { label: '10 points',   points: 10,   weight: 12 },
    { label: '20 points',   points: 20,   weight: 6 },
    { label: '50 points',   points: 50,   weight: 3 },
    { label: '100 points',  points: 100,  weight: 1.7 },
    { label: 'JACKPOT',     points: 1000, weight: 0.3 },
  ] as SpinSegment[],
};

export const TIER_RANK: Record<string, number> = { NoTier: 0, Basic: 1, Bronze: 2, Silver: 3, Gold: 4, Platinum: 5 };
export const isSpinEligible = (tier?: string): boolean => SPIN.enabled && (TIER_RANK[tier ?? 'NoTier'] ?? 0) >= SPIN.minTierRank;

// Weighted random slice index — SERVER-side only, so the outcome can't be gamed.
export const pickSegment = (segments: SpinSegment[]): number => {
  const total = segments.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) { r -= segments[i].weight; if (r < 0) return i; }
  return segments.length - 1;
};

// Calendar-day reset in IST: the UTC instant of the most recent IST midnight,
// and the next one (for the countdown).
const IST_MS = 5.5 * 3600 * 1000;
export const istDayStartUtc = (t: number = Date.now()): number => Math.floor((t + IST_MS) / 86400000) * 86400000 - IST_MS;
export const nextResetAt = (): Date => new Date(istDayStartUtc() + 86400000);
