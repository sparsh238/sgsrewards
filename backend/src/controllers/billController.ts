import { Request, Response } from 'express';
import Bill from '../models/billModel';
import User from '../models/userModel';
import System from '../models/systemModel';

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

      const pointsToAdd = pointsForBill(billAmount, user.tier, systemConfig);

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
        const filter: Record<string, unknown> = { userId: req.user._id };
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

export const getAllBills = async (req: Request, res: Response) => {
    try {
        // tier is included so the admin edit-bill modal can show the correct
        // tier-based points preview.
        const bills = await Bill.find().populate('userId', 'partyName phoneNumber tier');
        res.status(200).json(bills);
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

        // Reverse exactly what was granted (from the stored value; recompute only
        // for legacy bills that predate pointsAwarded), then grant the new amount.
        const oldPoints = typeof bill.pointsAwarded === 'number'
            ? bill.pointsAwarded
            : pointsForBill(bill.billAmount, user.tier, systemConfig);
        const newPoints = pointsForBill(billAmount, user.tier, systemConfig);
        const pointsDifference = newPoints - oldPoints;

        if (pointsDifference !== 0) {
            await adjustUserPoints(user._id, pointsDifference, pointsDifference);
        }

        bill.billNumber = billNumber;
        bill.billDate = billDate;
        bill.billAmount = billAmount;
        bill.pointsAwarded = newPoints;
        bill.period = toPeriod(billDate);
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

        // Subtract exactly what was granted (stored value; recompute only for
        // legacy bills). Balances are floored at 0 by adjustUserPoints.
        const pointsToSubtract = typeof bill.pointsAwarded === 'number'
            ? bill.pointsAwarded
            : pointsForBill(bill.billAmount, user.tier, systemConfig);

        if (pointsToSubtract > 0) {
            await adjustUserPoints(user._id, -pointsToSubtract, -pointsToSubtract);
        }

        await Bill.deleteOne({ _id: id });

        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while deleting the bill' });
    }
};
