import { Request, Response } from 'express';
import Bill from '../models/billModel';
import User from '../models/userModel';
import System from '../models/systemModel';
import { scopedDealerIds, dealerInScope, canEdit, isSales } from '../lib/salesScope';

// Single source of truth for how many points a bill is worth. Used identically
// by add/edit/delete so the three operations can never disagree.
// NoTier (and any tier missing a positive conversion rate) earns zero points.
const pointsForBill = (billAmount: number, tier: string, systemConfig: any): number => {
  if (tier === 'NoTier') return 0;
  const conversion = systemConfig?.tierPointsConversion?.[tier];
  if (!conversion || conversion <= 0) return 0;
  return Math.ceil(billAmount / conversion);
};

// Apply signed point deltas atomically, flooring both balances at 0 so a
// reversal can never push a user negative.
const adjustUserPoints = async (userId: unknown, availableDelta: number, totalDelta: number) => {
  await User.updateOne({ _id: userId }, [
    {
      $set: {
        availablePoints: { $max: [0, { $add: ['$availablePoints', availableDelta] }] },
        totalPoints: { $max: [0, { $add: ['$totalPoints', totalDelta] }] },
      },
    },
  ]);
};

const isValidAmount = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value > 0;

// The billing month "YYYY-MM" from a date. Tiers evaluate on this, so whoever
// enters/imports the bill must set billDate to the actual invoice date.
const toPeriod = (d: unknown): string => {
  const dt = new Date(d as string);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 7);
};

export const addBill = async (req: Request, res: Response) => {
    const { userId, billNumber, billDate, billAmount } = req.body;

    if (!isValidAmount(billAmount)) {
      return res.status(400).json({ error: 'billAmount must be a positive number' });
    }

    try {
      // Retrieve the system configuration
      const systemConfig = await System.findOne();
      if (!systemConfig) {
        return res.status(500).json({ error: 'System configuration not found' });
      }

      // Retrieve the user details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      if (isSales(req.user) && (!canEdit(req.user) || !dealerInScope(req.user, user))) {
        return res.status(403).json({ error: 'This dealer is outside your assigned area' });
      }

      // Out-of-scheme dealers (mobile-dominant) can redeem but never earn.
      const pointsToAdd = (user as { inScheme?: boolean }).inScheme === false
        ? 0
        : pointsForBill(billAmount, user.tier, systemConfig);

      // Persist the exact points granted (so edit/delete can reverse them precisely)
      // and the tier at billing time (for the admin audit view).
      const newBill = new Bill({ userId, billNumber, billDate, billAmount, pointsAwarded: pointsToAdd, tierAtBill: user.tier, period: toPeriod(billDate) });
      await newBill.save();

      if (pointsToAdd > 0) {
        await adjustUserPoints(userId, pointsToAdd, pointsToAdd);
      }

      res.status(201).json(newBill);
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while adding the bill' });
    }
  };

export const getUserBills = async (req: Request, res: Response) => {
    try {
        // Dealers never see voided (deleted) or excluded (disregarded) bills.
        const filter: Record<string, unknown> = { userId: req.user._id, voided: { $ne: true }, excluded: { $ne: true } };
        // Relaunch: the DEALER only sees bills from the relaunch month onward
        // (July 2026). Older legacy/seed bills still count toward their points
        // balance (merge), but are hidden from the dealer's bill list. Admins use
        // getAllBills and still see everything.
        filter.period = { $gte: process.env.RELAUNCH_PERIOD || '2026-07' };
        // Optional invoice-number search and month filter (period = 'YYYY-MM').
        const search = (req.query.search as string | undefined)?.trim();
        if (search) filter.billNumber = { $regex: search, $options: 'i' };
        const period = req.query.period as string | undefined;
        if (period && /^\d{4}-\d{2}$/.test(period)) {
            const start = new Date(`${period}-01T00:00:00Z`);
            const end = new Date(start); end.setMonth(end.getMonth() + 1);
            filter.billDate = { $gte: start, $lt: end };
        }

        const pageRaw = req.query.page as string | undefined;
        if (pageRaw === undefined) {
            const bills = await Bill.find(filter).sort({ billDate: -1 });
            return res.status(200).json(bills);
        }
        const page = Math.max(1, parseInt(pageRaw, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
        const [items, total] = await Promise.all([
            Bill.find(filter).sort({ billDate: -1 }).skip((page - 1) * pageSize).limit(pageSize),
            Bill.countDocuments(filter),
        ]);
        res.status(200).json({ items, total, page, pageSize });
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

export const getBillById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const bill = await Bill.findById(id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }
        res.status(200).json(bill);
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

// Paginated + filterable admin bill list. Filters: period (YYYY-MM), region
// (on the dealer), source ('manual' | 'busy'), and a search across bill number /
// dealer name / phone. Region + dealer search need the joined user, so this runs
// as an aggregation. Legacy bills predate the `source` field, so absent === manual.
export const getAllBills = async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 25));
        const period = String(req.query.period ?? '').trim();
        const region = String(req.query.region ?? '').trim();
        const source = String(req.query.source ?? '').trim();
        const search = String(req.query.search ?? '').trim();

        const pre: Record<string, unknown> = { voided: { $ne: true } };
        // Sales users only see bills for dealers inside their scope.
        const ids = await scopedDealerIds(req.user);
        if (ids) pre.userId = { $in: ids };
        if (/^\d{4}-\d{2}$/.test(period)) pre.period = period;
        if (source === 'busy') pre.source = 'busy';
        else if (source === 'manual') pre.source = { $in: ['manual', null] }; // null also matches a missing field

        const post: Record<string, unknown> = {};
        if (region) post['user.region'] = region;
        if (search) {
            // Whitespace- and case-insensitive: strip spaces from the query and allow
            // any spacing between characters in the stored value, so "sapnatrunk",
            // "sapna trunk" and "SAPNA  TRUNK" all match "Sapna Trunk And Electronics".
            const cleaned = search.replace(/\s+/g, '');
            if (cleaned) {
                const fuzzy = cleaned.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
                const rx = new RegExp(fuzzy, 'i');
                post.$or = [{ billNumber: rx }, { 'user.partyName': rx }, { 'user.phoneNumber': rx }];
            }
        }

        const [result] = await Bill.aggregate([
            { $match: pre },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $match: post },
            { $sort: { billDate: -1, _id: -1 } },
            { $facet: {
                items: [
                    { $skip: (page - 1) * pageSize },
                    { $limit: pageSize },
                    { $project: {
                        billNumber: 1, billDate: 1, billAmount: 1, pointsAwarded: 1, tierAtBill: 1, period: 1, lineItems: 1,
                        source: { $ifNull: ['$source', 'manual'] },
                        locked: { $ifNull: ['$locked', false] },
                        excluded: { $ifNull: ['$excluded', false] },
                        userId: { _id: '$user._id', partyName: '$user.partyName', phoneNumber: '$user.phoneNumber', tier: '$user.tier', region: '$user.region' },
                    } },
                ],
                total: [{ $count: 'n' }],
            } },
        ]);
        const items = result?.items ?? [];
        const total = result?.total?.[0]?.n ?? 0;
        const periods = (await Bill.distinct('period')).filter((p: string) => /^\d{4}-\d{2}$/.test(p)).sort().reverse();

        res.status(200).json({ items, total, page, pageSize, periods });
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

export const editBill = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { billNumber, billDate, billAmount } = req.body;

    if (!isValidAmount(billAmount)) {
        return res.status(400).json({ error: 'billAmount must be a positive number' });
    }

    try {
        const bill = await Bill.findById(id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        const systemConfig = await System.findOne();
        if (!systemConfig) {
            return res.status(500).json({ error: 'System configuration not found' });
        }

        const user = await User.findById(bill.userId);
        if (!user) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        if (isSales(req.user) && (!canEdit(req.user) || !dealerInScope(req.user, user))) {
            return res.status(403).json({ error: 'This bill is outside your assigned area' });
        }

        // Out-of-scheme dealers never earn — the same guard addBill applies, so an
        // edit can't quietly start crediting a redeem-only dealer.
        // A disregarded (excluded) bill earns nothing, and neither does a
        // redeem-only dealer — same guard addBill applies.
        const earns = (user as { inScheme?: boolean }).inScheme !== false && bill.excluded !== true;
        // Reverse exactly what was granted (from the stored value; recompute only
        // for legacy bills that predate pointsAwarded), then grant the new amount.
        const oldPoints = typeof bill.pointsAwarded === 'number'
            ? bill.pointsAwarded
            : (earns ? pointsForBill(bill.billAmount, user.tier, systemConfig) : 0);
        const newPoints = earns ? pointsForBill(billAmount, user.tier, systemConfig) : 0;
        const pointsDifference = newPoints - oldPoints;

        if (pointsDifference !== 0) {
            await adjustUserPoints(user._id, pointsDifference, pointsDifference);
        }

        bill.billAmount = billAmount;
        bill.pointsAwarded = newPoints;
        if (bill.source === 'busy') {
            // Synced bill: hand manual control to the admin (`locked` stops the Busy
            // sync from reverting the edit), and PIN the invoice number + date +
            // period. The sync re-matches bills by (billNumber|period); letting an
            // edit move that key would leave the original voucher unmatched and the
            // sync would re-insert it as a duplicate. Only the amount is editable.
            bill.locked = true;
        } else {
            bill.billNumber = billNumber;
            bill.billDate = billDate;
            bill.period = toPeriod(billDate);
        }
        await bill.save();

        res.status(200).json(bill);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while editing the bill' });
    }
};

export const deleteBill = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const bill = await Bill.findById(id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        const systemConfig = await System.findOne();
        if (!systemConfig) {
            return res.status(500).json({ error: 'System configuration not found' });
        }

        const user = await User.findById(bill.userId);
        if (!user) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        if (isSales(req.user) && (!canEdit(req.user) || !dealerInScope(req.user, user))) {
            return res.status(403).json({ error: 'This bill is outside your assigned area' });
        }

        // Subtract exactly what was granted (stored value; recompute only for
        // legacy bills). Out-of-scheme dealers never earned, so never subtract.
        // Balances are floored at 0 by adjustUserPoints.
        const earns = (user as { inScheme?: boolean }).inScheme !== false;
        const pointsToSubtract = typeof bill.pointsAwarded === 'number'
            ? bill.pointsAwarded
            : (earns ? pointsForBill(bill.billAmount, user.tier, systemConfig) : 0);

        if (pointsToSubtract > 0) {
            await adjustUserPoints(user._id, -pointsToSubtract, -pointsToSubtract);
        }

        // A manual bill can be hard-deleted — nothing will recreate it. A synced
        // ('busy') bill must be SOFT-deleted: the underlying Busy voucher still
        // exists, so a hard delete would be undone (re-inserted) on the next sync.
        // Void it instead — points already reversed above, row hidden everywhere,
        // and `locked` stops the sync from ever touching it again.
        if (bill.source === 'busy') {
            bill.voided = true;
            bill.locked = true;
            bill.pointsAwarded = 0;
            await bill.save();
        } else {
            await Bill.deleteOne({ _id: id });
        }

        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while deleting the bill' });
    }
};

// Toggle whether a bill is DISREGARDED. Excluding reverses its points and keeps
// the row (0 points, out of tier turnover via the `excluded` flag the aggregations
// filter on). Re-including re-credits points at the dealer's current tier. A synced
// bill is locked on exclude so the Busy sync won't re-credit it.
export const setBillExcluded = async (req: Request, res: Response) => {
    const { id } = req.params;
    const excluded = req.body?.excluded === true;

    try {
        const bill = await Bill.findById(id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }
        if (bill.voided) {
            return res.status(400).json({ error: 'Bill is deleted' });
        }
        if (bill.excluded === excluded) {
            return res.status(200).json(bill); // already in the requested state — no-op
        }

        const systemConfig = await System.findOne();
        if (!systemConfig) {
            return res.status(500).json({ error: 'System configuration not found' });
        }
        const user = await User.findById(bill.userId);
        if (!user) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        // Sales HEADS may exclude/include bills for dealers in their area (read-only
        // reps cannot; admin/superadmin are unrestricted).
        if (isSales(req.user)) {
            const su = req.user as { salesReadOnly?: boolean };
            if (!su.salesReadOnly) return res.status(403).json({ error: 'Only sales heads can exclude bills' });
            if (!dealerInScope(req.user, user)) return res.status(403).json({ error: 'This bill is outside your assigned area' });
        }
        const earns = (user as { inScheme?: boolean }).inScheme !== false;

        if (excluded) {
            // Disregard: pull back exactly what this bill granted.
            const back = typeof bill.pointsAwarded === 'number'
                ? bill.pointsAwarded
                : (earns ? pointsForBill(bill.billAmount, user.tier, systemConfig) : 0);
            if (back > 0) await adjustUserPoints(user._id, -back, -back);
            bill.excluded = true;
            bill.pointsAwarded = 0;
            if (bill.source === 'busy') bill.locked = true;
        } else {
            // Re-include: re-credit at the dealer's current tier (0 for redeem-only).
            const pts = earns ? pointsForBill(bill.billAmount, user.tier, systemConfig) : 0;
            if (pts > 0) await adjustUserPoints(user._id, pts, pts);
            bill.excluded = false;
            bill.pointsAwarded = pts;
            bill.tierAtBill = user.tier;
        }
        await bill.save();
        res.status(200).json(bill);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while updating the bill' });
    }
};
