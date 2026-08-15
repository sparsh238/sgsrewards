import { Request, Response } from 'express';
import User from '../models/userModel';
import System from '../models/systemModel';
import SpinLog from '../models/spinLogModel';
import { effectiveSpin, eligibleFor, pickSegment, istDayStartUtc, nextResetAt, type SpinConfig } from '../lib/spinConfig';

const loadConfig = async (): Promise<SpinConfig> => {
  const sys = await System.findOne().select('spinWheel');
  return effectiveSpin(sys?.spinWheel);
};

const hasSpunToday = (lastSpinAt?: Date | null): boolean =>
  !!lastSpinAt && new Date(lastSpinAt).getTime() >= istDayStartUtc();

// GET /api/spin/status — what the teaser + wheel screen render off.
export const getSpinStatus = async (req: Request, res: Response) => {
  try {
    const [user, cfg] = await Promise.all([
      User.findById((req.user as { _id: unknown })._id).select('tier availablePoints lastSpinAt lastSpinPoints'),
      loadConfig(),
    ]);
    if (!user) return res.status(404).send({ error: 'User not found' });
    const eligible = eligibleFor(user.tier, cfg);
    const spunToday = hasSpunToday(user.lastSpinAt);
    res.send({
      enabled: cfg.enabled,
      eligible,
      entryFee: cfg.entryFee,
      balance: user.availablePoints,
      canSpin: eligible && !spunToday && user.availablePoints >= cfg.entryFee,
      reason: !eligible ? 'ineligible' : spunToday ? 'spun-today' : user.availablePoints < cfg.entryFee ? 'low-balance' : null,
      segments: cfg.segments.map((s) => ({ label: s.label, points: s.points })), // no weights
      lastResult: spunToday ? (user.lastSpinPoints ?? 0) : null,
      nextResetAt: nextResetAt(),
    });
  } catch (error) {
    res.status(500).send({ error: 'Could not load spin status' });
  }
};

// POST /api/spin — spend the entry fee, pick a prize (server RNG), credit it,
// log the spin. Returns the winning slice index so the wheel animates to it.
export const doSpin = async (req: Request, res: Response) => {
  try {
    const cfg = await loadConfig();
    const user = await User.findById((req.user as { _id: unknown })._id).select('tier partyName availablePoints lastSpinAt');
    if (!user) return res.status(404).send({ error: 'User not found' });
    if (!eligibleFor(user.tier, cfg)) return res.status(403).send({ error: 'Reach Basic tier to unlock the daily spin' });
    if (hasSpunToday(user.lastSpinAt)) return res.status(409).send({ error: 'You already spun today — come back tomorrow' });
    if (user.availablePoints < cfg.entryFee) return res.status(400).send({ error: `You need ${cfg.entryFee} points to play` });

    const idx = pickSegment(cfg.segments);
    const prize = cfg.segments[idx].points;
    const net = prize - cfg.entryFee;
    const dayStart = new Date(istDayStartUtc());

    // Atomic guard: apply only if still enough balance AND not already spun today.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, availablePoints: { $gte: cfg.entryFee }, $or: [{ lastSpinAt: null }, { lastSpinAt: { $exists: false } }, { lastSpinAt: { $lt: dayStart } }] },
      { $inc: { availablePoints: net }, $set: { lastSpinAt: new Date(), lastSpinPoints: prize } },
      { new: true },
    );
    if (!updated) return res.status(409).send({ error: 'You already spun today — come back tomorrow' });

    // Audit trail (non-fatal — never blocks the payout).
    SpinLog.create({ userId: user._id, partyName: user.partyName, tier: user.tier, entryFee: cfg.entryFee, prize, segmentIndex: idx, balanceAfter: updated.availablePoints })
      .catch(() => {});

    res.send({ segmentIndex: idx, prize, entryFee: cfg.entryFee, newBalance: updated.availablePoints, nextResetAt: nextResetAt() });
  } catch (error) {
    res.status(500).send({ error: 'Spin failed — no points were deducted' });
  }
};
