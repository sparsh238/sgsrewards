// Tier progress engine.
//
// Tier is reviewed quarterly from billing. The progress bar shows the dealer's
// billed total this quarter against two thresholds: the requirement to KEEP
// the current tier, and the requirement to reach the NEXT tier.

import type { CSSProperties } from 'react';

export const TIER_ORDER = ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'] as const;
export type Tier = (typeof TIER_ORDER)[number];

/** A representative solid color per tier, for UI accents (nav tint, chips). */
export const TIER_ACCENT: Record<Tier, string> = {
  NoTier: '#9AA0A8',   // flat neutral grey
  Basic: '#83A9D8',    // metallic steel-blue
  Bronze: '#E8A867',   // warm bronze
  Silver: '#E4E9F0',   // bright chrome
  Gold: '#F0D083',     // gold
  Platinum: '#C4D0DE', // gunmetal
};

/**
 * Full theme token set per tier, applied as inline CSS variables on the dealer
 * frame so every screen inherits the accent. Basic–Gold ride the shared midnight
 * ground; Platinum overrides the ground/panels to black; No Tier stays flat grey.
 *
 * The accent is delivered by *remapping* the copper vars (--copper-hi/--copper/
 * --copper-deep/--on-copper), so existing screens recolour automatically. Green
 * (--ok) and red (--danger) are never touched — they mean "safe/done" and "risk".
 */
export const TIER_THEME: Record<Tier, Record<string, string>> = {
  NoTier: {
    '--copper-hi': '#9AA0A8', '--copper': '#868D96', '--copper-deep': '#6E747C', '--on-copper': '#14181F',
    '--card': '#1C222C', '--card-ink': '#B9C0CC', '--card-sheen': '0', '--card-border': '#3A424F',
    '--coin-bg': '#39414D', '--coin-bd': '#545E6C', '--coin-ic': '#6E7785', '--coin-label': '#9AA0A8',
  },
  Basic: {
    '--copper-hi': '#83A9D8', '--copper': '#5E86BC', '--copper-deep': '#4E7CB2', '--on-copper': '#0B1826',
    '--card': 'linear-gradient(135deg,#26313F,#83A6CE 50%,#212B38)', '--card-ink': '#0E1826',
    '--card-sheen': '0.42', '--card-border': 'transparent',
    '--coin-bg': '#84A3CC', '--coin-bd': '#2C3E56', '--coin-ic': '#172536', '--coin-label': '#83A9D8',
  },
  Bronze: {
    '--copper-hi': '#E8A867', '--copper': '#C1793B', '--copper-deep': '#9A5F2C', '--on-copper': '#2A1608',
    '--card': 'linear-gradient(135deg,#6E451F,#D89A5E 48%,#5E3A1F)', '--card-ink': '#2A1608',
    '--card-sheen': '0.28', '--card-border': 'transparent',
    '--coin-bg': '#D89A5E', '--coin-bd': '#7A4A22', '--coin-ic': '#5A3316', '--coin-label': '#E8A867',
  },
  Silver: {
    '--copper-hi': '#E4E9F0', '--copper': '#B7BFC9', '--copper-deep': '#8A929C', '--on-copper': '#14181F',
    '--card': 'linear-gradient(135deg,#AEB4BE,#F7F9FC 50%,#AEB4BE)', '--card-ink': '#14181F',
    '--card-sheen': '0.5', '--card-border': 'transparent',
    '--coin-bg': '#EBEFF4', '--coin-bd': '#7A828E', '--coin-ic': '#333A44', '--coin-label': '#DDE3EB',
  },
  Gold: {
    '--copper-hi': '#F0D083', '--copper': '#C69B3D', '--copper-deep': '#9A7A2C', '--on-copper': '#241A02',
    '--card': 'linear-gradient(135deg,#8A6B21,#F4DB90 50%,#7A5D1C)', '--card-ink': '#241A02',
    '--card-sheen': '0.32', '--card-border': 'transparent',
    '--coin-bg': '#E9C877', '--coin-bd': '#7A5D18', '--coin-ic': '#5A4310', '--coin-label': '#F0D083',
  },
  Platinum: {
    // Full black override — ground, panels and nav all darken.
    '--ground': '#0A0B0E', '--ground-glow': '#161A20', '--panel': '#111318', '--panel-raised': '#171A20',
    '--hairline': '#252A31', '--nav-bg': '#0A0B0E', '--muted': '#868D97',
    '--copper-hi': '#C4D0DE', '--copper': '#96A3B4', '--copper-deep': '#6E7B8C', '--on-copper': '#0E1116',
    '--card': 'linear-gradient(135deg,#0B0D11,#3C4653 50%,#0B0D11)', '--card-ink': '#DCE3ED',
    '--card-sheen': '0.13', '--card-border': '#2C333D',
    '--coin-bg': '#12151A', '--coin-bd': '#9FB0C2', '--coin-ic': '#9FB0C2', '--coin-label': '#AEBECF',
  },
};

/** Inline-style object of the tier's CSS variables, for the dealer frame. */
export function tierStyleVars(tier: Tier | null): CSSProperties {
  return (TIER_THEME[tier ?? 'NoTier'] ?? TIER_THEME.NoTier) as CSSProperties;
}

export type TierRequirements = Partial<Record<Tier, number>>;

export interface Bill {
  _id: string;
  billNumber: string;
  billDate: string;
  billAmount: number;
  pointsAwarded?: number;
  period?: string;
}

function sumBills(bills: Bill[], startMs: number, endMs: number): { billed: number; earned: number } {
  return bills.reduce(
    (acc, b) => {
      const t = new Date(b.billDate).getTime();
      if (t >= startMs && t <= endMs) {
        acc.billed += b.billAmount;
        acc.earned += b.pointsAwarded ?? 0;
      }
      return acc;
    },
    { billed: 0, earned: 0 },
  );
}

/** Bill amounts and awarded points for the current calendar month. */
export function thisMonth(bills: Bill[], now = new Date()): { billed: number; earned: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return sumBills(bills, start, end);
}

/** Bill amounts and awarded points for the current quarter. */
export function thisQuarter(bills: Bill[], now = new Date()): { billed: number; earned: number } {
  return sumBills(bills, quarterStart(now).getTime(), quarterEnd(now).getTime());
}

export function monthLabel(now = new Date()): string {
  return now.toLocaleDateString('en-IN', { month: 'long' });
}

/** Start of the current calendar quarter. */
export function quarterStart(now = new Date()): Date {
  const q = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3, 1);
}

export function quarterEnd(now = new Date()): Date {
  const q = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
}

// Indian fiscal quarter (Apr–Mar): Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
// The date window matches the calendar quarter above; only the label differs.
function fyQuarter(now: Date): { q: number; fyStart: number } {
  const y = now.getFullYear(), m = now.getMonth();
  if (m >= 3 && m <= 5) return { q: 1, fyStart: y };
  if (m >= 6 && m <= 8) return { q: 2, fyStart: y };
  if (m >= 9 && m <= 11) return { q: 3, fyStart: y };
  return { q: 4, fyStart: y - 1 };
}

export function quarterLabel(now = new Date()): string {
  const { q, fyStart } = fyQuarter(now);
  return `Q${q} · FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

/** Stable identifier for the current fiscal quarter, e.g. "2026-Q2" — matches the
 *  backend's fiscalQuarter key; fires the quarterly tier-welcome once per quarter. */
export function quarterKey(now = new Date()): string {
  const { q, fyStart } = fyQuarter(now);
  return `${fyStart}-Q${q}`;
}

/** Sum of bills dated inside the current quarter. */
export function billedThisQuarter(bills: Bill[], now = new Date()): number {
  const start = quarterStart(now).getTime();
  const end = quarterEnd(now).getTime();
  return bills.reduce((sum, b) => {
    const t = new Date(b.billDate).getTime();
    return t >= start && t <= end ? sum + b.billAmount : sum;
  }, 0);
}

export function nextTierOf(tier: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

export function prevTierOf(tier: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i > 0 ? TIER_ORDER[i - 1] : null;
}

export type PointsConversions = Partial<Record<Tier, number>>;

/** Earning tiers, ascending by rank (NoTier excluded). Assumed ascending by requirement. */
export const EARN_TIERS = TIER_ORDER.filter((t) => t !== 'NoTier') as Exclude<Tier, 'NoTier'>[];

const rank = (t: Tier): number => TIER_ORDER.indexOf(t);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Highest tier whose billing requirement is met; null = below Basic (out of scheme). */
export function securedTier(billed: number, requirements: TierRequirements): Tier | null {
  let result: Tier | null = null;
  for (const t of EARN_TIERS) {
    const req = requirements[t];
    if (req !== undefined && billed >= req) result = t;
  }
  return result;
}

export type NudgeState = 'notier' | 'risk' | 'safe' | 'top';

export interface Nudge {
  billed: number;
  daysLeft: number;
  weeksLeft: number;
  state: NudgeState;
  currentTier: Tier;
  defended: boolean;
  // Defend gauge — fill = gaugeFrac; green when secured, red when short.
  gaugeFrac: number;
  gaugeSecured: boolean;
  keepReq: number | null;
  toKeep: number;
  dropTo: Tier | 'out' | null; // where they fall if they miss the keep line
  // Advance — the single next rung above the current tier.
  advanceTier: Tier | null;
  advanceReq: number | null;
  advanceFrac: number;
  toNext: number;
  currentRate: number | null;  // ₹ billed per 1 point now (higher = worse)
  nextRate: number | null;     // …at the advance tier (lower = better)
  // Re-entry (NoTier only)
  reentryReq: number | null;
  toReenter: number;
  securedTier: Tier | null; // tier this quarter's billing already earns (for NoTier: what they'll be enrolled at)
  // Weekly pace for the active push
  weeklyTarget: number;
  weeklyGoal: { verb: 'defend' | 'reach' | 'reenter'; tier: Tier | null };
}

// Single source of truth for the Home billing nudge. Everything the component
// shows — defend gauge, rolling advance target, out-of-scheme floor, weekly
// pace — is derived here from billing thresholds (never tier±1), so
// non-sequential jumps and multi-tier drops both work.
export function computeNudge(
  tier: Tier,
  bills: Bill[],
  requirements: TierRequirements,
  conversions: PointsConversions,
  now = new Date(),
): Nudge {
  const billed = billedThisQuarter(bills, now);
  const daysLeft = Math.max(0, Math.ceil((quarterEnd(now).getTime() - now.getTime()) / 86_400_000));
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const secured = securedTier(billed, requirements);

  const keepReq = tier === 'NoTier' ? null : requirements[tier] ?? null;
  const defended = tier !== 'NoTier' && keepReq !== null && billed >= keepReq;
  const currentRate = tier === 'NoTier' ? null : conversions[tier] ?? null;

  // Advance target: the lowest earning tier still un-crossed AND above the
  // current tier. Rolls forward (Silver → Gold → Platinum) as billing climbs.
  let advanceTier: Tier | null = null;
  for (const t of EARN_TIERS) {
    const req = requirements[t];
    if (req === undefined) continue;
    if (req > billed && rank(t) > rank(tier)) { advanceTier = t; break; }
  }
  const advanceReq = advanceTier ? requirements[advanceTier] ?? null : null;
  const nextRate = advanceTier ? conversions[advanceTier] ?? null : null;

  const reentryReq = requirements.Basic ?? null;

  let state: NudgeState;
  if (tier === 'NoTier') state = 'notier';
  else if (!defended) state = 'risk';
  else if (advanceTier) state = 'safe';
  else state = 'top';

  const toKeep = keepReq !== null ? Math.max(0, keepReq - billed) : 0;
  const toNext = advanceReq !== null ? Math.max(0, advanceReq - billed) : 0;
  const toReenter = reentryReq !== null ? Math.max(0, reentryReq - billed) : 0;

  const gaugeSecured = state === 'safe' || state === 'top';
  const gaugeFrac = gaugeSecured ? 1 : (keepReq ? clamp01(billed / keepReq) : 0);
  const dropTo: Tier | 'out' | null = state === 'risk' ? (secured ?? 'out') : null;

  let weeklyTarget = 0;
  let weeklyGoal: Nudge['weeklyGoal'] = { verb: 'defend', tier };
  if (state === 'notier') {
    weeklyTarget = toReenter / weeksLeft;
    weeklyGoal = { verb: 'reenter', tier: 'Basic' };
  } else if (state === 'risk') {
    weeklyTarget = toKeep / weeksLeft;
    weeklyGoal = { verb: 'defend', tier };
  } else if (state === 'safe' && advanceTier) {
    weeklyTarget = toNext / weeksLeft;
    weeklyGoal = { verb: 'reach', tier: advanceTier };
  }

  return {
    billed, daysLeft, weeksLeft, state, currentTier: tier, defended,
    gaugeFrac, gaugeSecured, keepReq, toKeep, dropTo,
    advanceTier, advanceReq, advanceFrac: advanceReq ? clamp01(billed / advanceReq) : 0,
    toNext, currentRate, nextRate,
    reentryReq, toReenter, securedTier: secured,
    weeklyTarget, weeklyGoal,
  };
}

export interface Rung {
  tier: Exclude<Tier, 'NoTier'>;
  requirement: number | null;
  rate: number | null;          // ₹ billed per 1 point
  status: 'crossed' | 'defend' | 'next' | 'ahead';
  isCurrent: boolean;           // the dealer's stored tier
  toClimb: number;              // ₹ remaining to cross/re-secure (0 if crossed)
}

// Ladder for the Tier page, top (Platinum) → bottom (Basic).
export function tierLadder(
  currentTier: Tier,
  bills: Bill[],
  requirements: TierRequirements,
  conversions: PointsConversions,
  now = new Date(),
): { rungs: Rung[]; billed: number; outOfScheme: boolean } {
  const billed = billedThisQuarter(bills, now);
  const nudge = computeNudge(currentTier, bills, requirements, conversions, now);

  const rungs: Rung[] = EARN_TIERS.map((t) => {
    const req = requirements[t] ?? null;
    const crossed = req !== null && billed >= req;
    // The dealer's own tier, when this quarter's billing hasn't re-cleared it yet,
    // is being DEFENDED (needs re-billing to keep) — not "away" like an unreached rung.
    const status: Rung['status'] = crossed ? 'crossed'
      : t === currentTier ? 'defend'
        : t === nudge.advanceTier ? 'next' : 'ahead';
    return {
      tier: t,
      requirement: req,
      rate: conversions[t] ?? null,
      status,
      isCurrent: t === currentTier,
      toClimb: req !== null ? Math.max(0, req - billed) : 0,
    };
  }).reverse(); // Platinum first

  return { rungs, billed, outOfScheme: securedTier(billed, requirements) === null };
}
