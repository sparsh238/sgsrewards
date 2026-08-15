import { Request, Response } from 'express';
import User from '../models/userModel';
import { SPIN, isSpinEligible, pickSegment, istDayStartUtc, nextResetAt } from '../lib/spinConfig';

// Slices sent to the client carry only label + points — never the weights (odds
// stay server-side / admin-only).
const publicSegments = () => SPIN.segments.map((s) => ({ label: s.label, points: s.points }));

const hasSpunToday = (lastSpinAt?: Date | null): boolean =>
  !!lastSpinAt && new Date(lastSpinAt).getTime() >= istDayStartUtc();

// GET /api/spin/status — what the teaser + wheel screen render off.
export const getSpinStatus = async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req.user as { _id: unknown })._id).select('tier availablePoints lastSpinAt lastSpinPoints');
    if (!user) return res.status(404).send({ error: 'User not found' });
    const eligible = isSpinEligible(user.tier);
    const spunToday = hasSpunToday(user.lastSpinAt);
    res.send({
      enabled: SPIN.enabled,
      eligible,
      entryFee: SPIN.entryFee,
      balance: user.availablePoints,
      canSpin: eligible && !spunToday && user.availablePoints >= SPIN.entryFee,
      reason: !eligible ? 'ineligible' : spunToday ? 'spun-today' : user.availablePoints < SPIN.entryFee ? 'low-balance' : null,
      segments: publicSegments(),
      lastResult: spunToday ? (user.lastSpinPoints ?? 0) : null,
      nextResetAt: nextResetAt(),
    });
  } catch (error) {
    res.status(500).send({ error: 'Could not load spin status' });
  }
};

// POST /api/spin — spend the entry fee, pick a prize (server RNG), credit it.
// The winning slice index is returned so the wheel animates to it.
export const doSpin = async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req.user as { _id: unknown })._id).select('tier availablePoints lastSpinAt');
    if (!user) return res.status(404).send({ error: 'User not found' });
    if (!isSpinEligible(user.tier)) return res.status(403).send({ error: 'Reach Basic tier to unlock the daily spin' });
    if (hasSpunToday(user.lastSpinAt)) return res.status(409).send({ error: 'You already spun today — come back tomorrow' });
    if (user.availablePoints < SPIN.entryFee) return res.status(400).send({ error: `You need ${SPIN.entryFee} points to play` });

    const idx = pickSegment(SPIN.segments);
    const prize = SPIN.segments[idx].points;
    const net = prize - SPIN.entryFee;
    const dayStart = new Date(istDayStartUtc());

    // Atomic guard: only apply if still enough balance AND not already spun today
    // (prevents a double-spend from two rapid taps).
    const updated = await User.findOneAndUpdate(
      { _id: user._id, availablePoints: { $gte: SPIN.entryFee }, $or: [{ lastSpinAt: null }, { lastSpinAt: { $exists: false } }, { lastSpinAt: { $lt: dayStart } }] },
      { $inc: { availablePoints: net }, $set: { lastSpinAt: new Date(), lastSpinPoints: prize } },
      { new: true },
    );
    if (!updated) return res.status(409).send({ error: 'You already spun today — come back tomorrow' });

    res.send({ segmentIndex: idx, prize, entryFee: SPIN.entryFee, newBalance: updated.availablePoints, nextResetAt: nextResetAt() });
  } catch (error) {
    res.status(500).send({ error: 'Spin failed — no points were deducted' });
  }
};
