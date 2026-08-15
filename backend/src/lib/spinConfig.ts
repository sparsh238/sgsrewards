// Daily Spin-the-Wheel config + helpers. Points-only prizes, one spin per
// calendar day (IST), eligible for a minimum tier and up. The prize weights set
// the economics; dealers never see the weights. The LIVE config is stored on the
// System doc (superadmin-editable) — this file holds the DEFAULT + the helpers.
export interface SpinSegment { label: string; points: number; weight: number }
export interface SpinConfig { enabled: boolean; entryFee: number; minTierRank: number; segments: SpinSegment[] }

// "Neutral" default: average payout ≈ entry (near-zero net liability), with a
// rare jackpot. Two "Better luck" slices so the common outcome isn't one wedge.
export const DEFAULT_SPIN: SpinConfig = {
  enabled: true,
  entryFee: 10,
  minTierRank: 1, // Basic and up (NoTier = 0 excluded)
  segments: [
    { label: 'Better luck', points: 0,    weight: 28 },
    { label: '5 points',    points: 5,    weight: 22 },
    { label: 'Better luck', points: 0,    weight: 27 },
    { label: '10 points',   points: 10,   weight: 12 },
    { label: '20 points',   points: 20,   weight: 6 },
    { label: '50 points',   points: 50,   weight: 3 },
    { label: '100 points',  points: 100,  weight: 1.7 },
    { label: 'JACKPOT',     points: 1000, weight: 0.3 },
  ],
};

export const TIER_RANK: Record<string, number> = { NoTier: 0, Basic: 1, Bronze: 2, Silver: 3, Gold: 4, Platinum: 5 };

// The live config = the System override if it carries a valid segment list,
// otherwise the default. Scalar fields fall back individually.
export const effectiveSpin = (override?: Partial<SpinConfig> | null): SpinConfig => {
  const segs = Array.isArray(override?.segments) && override!.segments.length ? override!.segments : DEFAULT_SPIN.segments;
  return {
    enabled: typeof override?.enabled === 'boolean' ? override!.enabled : DEFAULT_SPIN.enabled,
    entryFee: typeof override?.entryFee === 'number' ? override!.entryFee : DEFAULT_SPIN.entryFee,
    minTierRank: typeof override?.minTierRank === 'number' ? override!.minTierRank : DEFAULT_SPIN.minTierRank,
    segments: segs,
  };
};

export const eligibleFor = (tier: string | undefined, cfg: SpinConfig): boolean =>
  cfg.enabled && (TIER_RANK[tier ?? 'NoTier'] ?? 0) >= cfg.minTierRank;

// Weighted random slice index — SERVER-side only, so the outcome can't be gamed.
export const pickSegment = (segments: SpinSegment[]): number => {
  const total = segments.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) { r -= Math.max(0, segments[i].weight); if (r < 0) return i; }
  return segments.length - 1;
};

// Calendar-day reset in IST.
const IST_MS = 5.5 * 3600 * 1000;
export const istDayStartUtc = (t: number = Date.now()): number => Math.floor((t + IST_MS) / 86400000) * 86400000 - IST_MS;
export const nextResetAt = (): Date => new Date(istDayStartUtc() + 86400000);
