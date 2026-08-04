import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/userModel';
import System from '../models/systemModel';
import  Bill  from '../models/billModel';
import OrderModel from '../models/orderModel';

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    res.send(users);
  } catch (error) {
    res.status(500).send(error);
  }
};

const addUser = async (req: Request, res: Response) => {
  const { partyName, phoneNumber, userType, gstin, region, district } = req.body;
  const isCustomer = userType === 'customer';
  // Dealers: 4-digit PIN + auto username (phone is the login). Staff: username + password.
  const secret = isCustomer ? (req.body.pin ?? req.body.password) : req.body.password;
  const username = isCustomer ? (req.body.username || phoneNumber) : req.body.username;

  if (!partyName || !phoneNumber || !secret || !userType) {
    return res.status(400).send({ error: 'All fields are required' });
  }
  if (isCustomer && !/^\d{4}$/.test(String(secret))) {
    return res.status(400).send({ error: 'Dealer PIN must be exactly 4 digits' });
  }
  if (!isCustomer && !username) {
    return res.status(400).send({ error: 'Username is required for staff accounts' });
  }

  try {
    if (isCustomer) {
      const existing = await User.findOne({ phoneNumber });
      if (existing) {
        return res.status(400).send({ error: 'A dealer with this phone number already exists' });
      }
    }
    const hashedPassword = await bcrypt.hash(String(secret), 8);
    const user = new User({ username, partyName, phoneNumber, password: hashedPassword, userType, isPasswordReset: false, gstin: gstin ?? '', region: region ?? '', district: district ?? '' });
    await user.save();
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send(error);
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    await Bill.deleteMany({ userId: user._id });

    await OrderModel.deleteMany({ userId: user._id });
   
    await User.findByIdAndDelete(req.params.id);

    res.send({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};

const blockUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    user.blocked = req.body.blocked;
    await user.save();
    res.send(user);
  } catch (error) {
    res.status(500).send(error);
  }
};

const resetPassword = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Dealers get a 4-digit temp PIN; staff get a password. Either way,
    // isPasswordReset=false forces the user to set their own on next login.
    const secret = req.body.newPassword;
    if (user.userType === 'customer' && !/^\d{4}$/.test(String(secret))) {
      return res.status(400).send({ error: 'Dealer PIN must be exactly 4 digits' });
    }
    if (!secret) {
      return res.status(400).send({ error: 'A new PIN/password is required' });
    }

    user.password = await bcrypt.hash(String(secret), 8);
    user.isPasswordReset = false;
    await user.save();

    res.status(200).send({ message: 'Reset successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error resetting' });
  }
};

const getPointsConversion = async (req: Request, res: Response) => {
  try {
      const system = await System.findOne();
      if (!system) {
          return res.status(404).send({ message: 'System settings not found' });
      }
      res.send({
          pointsConversion: system.pointsConversion,
          tierPointsConversion: system.tierPointsConversion,
      });
  } catch (error) {
      res.status(500).send(error);
  }
};

const updatePointsConversion = async (req: Request, res: Response) => {
  try {
      const { pointsConversion, tierPointsConversion } = req.body;

      let system = await System.findOne();
      if (!system) {
          system = new System({
              pointsConversion,
              tierPointsConversion,
          });
      } else {
          if (pointsConversion !== undefined) system.pointsConversion = pointsConversion;
          if (tierPointsConversion !== undefined) system.tierPointsConversion = tierPointsConversion;
      }

      await system.save();
      res.send(system);
  } catch (error) {
      res.status(500).send(error);
  }
};

  const changeUserTier = async (req: Request, res: Response) => {
    const { userId, newTier } = req.body;

    try {
        // Validate the new tier
        const validTiers = ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'];
        if (!validTiers.includes(newTier)) {
            return res.status(400).send({ error: `Invalid tier. Allowed values are: ${validTiers.join(', ')}` });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }

        // Update the user's tier. On a real change, record where they came from
        // and flag the quarterly welcome as unseen so the app reveals it once.
        if (user.tier !== newTier) {
            user.previousTier = user.tier;
            user.tierWelcomeSeen = false;
        }
        user.tier = newTier;
        await user.save();

        res.status(200).send({ message: `User tier updated to ${newTier}`, user });
    } catch (error) {
        console.error('Error updating user tier:', error);
        res.status(500).send({ error: 'An unknown error occurred while updating the user tier.' });
    }
};

const getTierBillingRequirements = async (req: Request, res: Response) => {
  try {
    const system = await System.findOne();
    if (!system) {
      return res.status(404).json({ message: 'System settings not found' });
    }
    res.status(200).json({ tierBillingRequirements: system.tierBillingRequirements });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const updateTierBillingRequirements = async (req: Request, res: Response) => {
  try {
    const { tierBillingRequirements } = req.body;
    if (!tierBillingRequirements) {
      return res.status(400).json({ message: 'Tier billing requirements are required.' });
    }

    let system = await System.findOne();
    if (!system) {
      system = new System({ pointsConversion: 1 }); // Default pointsConversion if missing
    }

    system.tierBillingRequirements = tierBillingRequirements;
    await system.save();

    res.status(200).json({ message: 'Tier billing requirements updated successfully', system });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const refreshUserList = async (req: Request, res: Response) => {
  // Logic to refresh user list from Busy API
};

const TIER_ORDER = ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'];

// Highest tier whose quarterly billing requirement the dealer met in the window.
const tierForBilling = (billed: number, reqs: Record<string, number>): string => {
  let result = 'NoTier';
  for (const t of TIER_ORDER) {
    const need = reqs?.[t];
    if (typeof need === 'number' && billed >= need) result = t;
  }
  return result;
};

// Quarterly tier review: proposals only, never applied here. Sums each dealer's
// billing in [from, to) and proposes the tier it earns, vs their current tier.
const getTierReview = async (req: Request, res: Response) => {
  try {
    const system = await System.findOne();
    const reqs = (system?.tierBillingRequirements ?? {}) as Record<string, number>;

    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(new Date(to).setMonth(to.getMonth() - 3));

    const agg = await Bill.aggregate([
      { $match: { billDate: { $gte: from, $lt: to } } },
      { $group: { _id: '$userId', billed: { $sum: '$billAmount' } } },
    ]);
    const billedByUser = new Map<string, number>(agg.map((a) => [String(a._id), a.billed]));

    const users = await User.find({ userType: 'customer' });
    const rank = (t: string) => TIER_ORDER.indexOf(t);
    const rows = users.map((u) => {
      const billed = billedByUser.get(String(u._id)) ?? 0;
      const proposedTier = tierForBilling(billed, reqs);
      const dir = rank(proposedTier) > rank(u.tier) ? 'up' : rank(proposedTier) < rank(u.tier) ? 'down' : 'hold';
      return {
        userId: u._id, partyName: u.partyName, phoneNumber: u.phoneNumber, gstin: u.gstin,
        region: u.region, billed, currentTier: u.tier, proposedTier, direction: dir,
        isNewEntrant: u.tier === 'NoTier' && proposedTier !== 'NoTier',
      };
    });
    const changes = rows.filter((r) => r.direction !== 'hold');
    res.send({
      from, to,
      counts: {
        changes: changes.length,
        up: changes.filter((r) => r.direction === 'up').length,
        down: changes.filter((r) => r.direction === 'down').length,
        newEntrants: changes.filter((r) => r.isNewEntrant).length,
      },
      changes,
    });
  } catch (error) {
    res.status(500).send({ error: 'Failed to compute tier review' });
  }
};

// Apply approved rows. Reuses the change-tier semantics: records previousTier and
// flags the welcome so each promoted/dropped dealer sees it once.
const applyTierReview = async (req: Request, res: Response) => {
  const { changes } = req.body as { changes?: Array<{ userId: string; proposedTier: string }> };
  if (!Array.isArray(changes)) return res.status(400).send({ error: 'changes[] required' });
  try {
    let applied = 0;
    for (const c of changes) {
      if (!TIER_ORDER.includes(c.proposedTier)) continue;
      const user = await User.findById(c.userId);
      if (!user || user.tier === c.proposedTier) continue;
      user.previousTier = user.tier;
      user.tierWelcomeSeen = false;
      user.tier = c.proposedTier as typeof user.tier;
      await user.save();
      applied++;
    }
    res.send({ applied });
  } catch (error) {
    res.status(500).send({ error: 'Failed to apply tier review' });
  }
};

export { getAllUsers, addUser, deleteUser, blockUser, resetPassword, getPointsConversion, updatePointsConversion, changeUserTier, getTierBillingRequirements, updateTierBillingRequirements, refreshUserList, getTierReview, applyTierReview };
