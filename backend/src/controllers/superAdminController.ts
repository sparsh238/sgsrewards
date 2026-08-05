import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/userModel';
import System from '../models/systemModel';
import  Bill  from '../models/billModel';
import OrderModel from '../models/orderModel';
import { fiscalQuarter } from '../lib/fiscalQuarter';
import { AREAS, AREA_NAMES, areasToScope } from '../lib/salesAreas';

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

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
};

// Superadmin edit of a dealer's fields. GSTIN is the definitive key and is NOT
// editable here; everything else (display name, contact name, DOB, anniversary,
// phone) is. Phone changes are checked for uniqueness.
const updateDealer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { partyName, firstName, lastName, dateOfBirth, anniversaryDate, phoneNumber, inScheme } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).send({ error: 'Dealer not found' });

    if (phoneNumber !== undefined && String(phoneNumber) !== user.phoneNumber) {
      const phone = String(phoneNumber).trim();
      if (!/^\d{10}$/.test(phone)) return res.status(400).send({ error: 'Phone must be 10 digits' });
      const clash = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id } });
      if (clash) return res.status(400).send({ error: 'Another account already uses that phone number' });
      // Dealers log in by phone; keep the auto-username in sync when it was the phone.
      if (user.username === user.phoneNumber) user.username = phone;
      user.phoneNumber = phone;
    }
    if (partyName !== undefined) {
      if (!String(partyName).trim()) return res.status(400).send({ error: 'Display name cannot be empty' });
      user.partyName = String(partyName).trim();
    }
    if (firstName !== undefined) user.firstName = String(firstName).trim();
    if (lastName !== undefined) user.lastName = String(lastName).trim();
    if (dateOfBirth !== undefined) user.dateOfBirth = toDateOrNull(dateOfBirth);
    if (anniversaryDate !== undefined) user.anniversaryDate = toDateOrNull(anniversaryDate);
    if (inScheme !== undefined) user.inScheme = Boolean(inScheme);
    await user.save();
    res.send(user);
  } catch (error) {
    res.status(500).send({ error: 'Failed to update dealer' });
  }
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
// billing in the CURRENT fiscal quarter and proposes the tier it earns.
const getTierReview = async (req: Request, res: Response) => {
  try {
    const system = await System.findOne();
    const reqs = (system?.tierBillingRequirements ?? {}) as Record<string, number>;
    const fq = fiscalQuarter(new Date());

    // Match on the TRUE billing month (period), not the entry date, so back-dated
    // bills land in the quarter they belong to.
    const agg = await Bill.aggregate([
      { $match: { period: { $gte: fq.periodFrom, $lt: fq.periodTo } } },
      { $group: { _id: '$userId', billed: { $sum: '$billAmount' } } },
    ]);
    const billedByUser = new Map<string, number>(agg.map((a) => [String(a._id), a.billed]));

    // Only in-scheme (real CD) dealers are reviewed; out-of-scheme never earn/change tier.
    const users = await User.find({ userType: 'customer', inScheme: { $ne: false } });
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
      quarter: fq.key, quarterLabel: fq.label, fyLabel: fq.fyLabel, from: fq.from, to: fq.to,
      alreadyApplied: system?.lastTierReviewQuarter === fq.key,
      appliedAt: system?.lastTierReviewQuarter === fq.key ? system?.lastTierReviewAt : null,
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

// Apply approved rows. Once per quarter unless `force` is passed. Reuses the
// change-tier semantics: records previousTier and flags the welcome once.
const applyTierReview = async (req: Request, res: Response) => {
  const { changes, force } = req.body as { changes?: Array<{ userId: string; proposedTier: string }>; force?: boolean };
  if (!Array.isArray(changes)) return res.status(400).send({ error: 'changes[] required' });
  try {
    const system = await System.findOne();
    const fq = fiscalQuarter(new Date());
    if (system?.lastTierReviewQuarter === fq.key && !force) {
      return res.status(409).send({
        error: 'ALREADY_APPLIED',
        message: `Tier review for ${fq.label} was already applied on ${system?.lastTierReviewAt}. Recompute to run it again.`,
        quarter: fq.key, appliedAt: system?.lastTierReviewAt,
      });
    }
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
    if (system) {
      system.lastTierReviewQuarter = fq.key;
      system.lastTierReviewAt = new Date();
      await system.save();
    }
    res.send({ applied, quarter: fq.key });
  } catch (error) {
    res.status(500).send({ error: 'Failed to apply tier review' });
  }
};

// The named areas the create-salesperson form offers.
const getSalesAreas = async (_req: Request, res: Response) => {
  res.send({ areas: AREA_NAMES });
};

// Create a sales-team login (rep or read-only head). Scope is derived from the
// assigned areas. Username must be unique; the temp password forces a reset on
// first login. `readOnly: true` = Sales Head (view-only over their scope).
const addSalesUser = async (req: Request, res: Response) => {
  const { partyName, username, password, areas, readOnly, salesHead } = req.body as {
    partyName?: string; username?: string; password?: string; areas?: string[]; readOnly?: boolean; salesHead?: string;
  };
  if (!partyName || !username || !password) {
    return res.status(400).send({ error: 'Name, username and a temp password are required' });
  }
  const validAreas = (Array.isArray(areas) ? areas : []).filter((a) => AREAS[a]);
  if (validAreas.length === 0) {
    return res.status(400).send({ error: 'Assign at least one area' });
  }
  try {
    if (await User.findOne({ username })) {
      return res.status(400).send({ error: 'That username is already taken' });
    }
    const { salesRegions, salesBooks } = areasToScope(validAreas);
    const doc: Record<string, unknown> = {
      username, partyName,
      phoneNumber: req.body.phoneNumber || username, // schema requires non-empty; username is a safe placeholder
      password: await bcrypt.hash(String(password), 8),
      userType: 'sales', isPasswordReset: false,
      salesReadOnly: !!readOnly, salesAreas: validAreas, salesRegions, salesBooks,
    };
    // A rep can report to a Sales Head (linked by the head's username); heads report to no one.
    if (!readOnly && salesHead) {
      const head = await User.findOne({ username: salesHead, userType: 'sales', salesReadOnly: true });
      if (!head) return res.status(400).send({ error: 'Selected sales head not found' });
      doc.salesHead = salesHead;
    }
    const user = new User(doc);
    await user.save();
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send({ error: 'Could not create the sales user' });
  }
};

// Edit a sales login: name, areas (scope recomputed), rep/head role, and which
// Sales Head a rep reports to. Username + password are left untouched (password
// changes go through the reset flow).
const updateSalesUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { partyName, areas, readOnly, salesHead } = req.body as {
    partyName?: string; areas?: string[]; readOnly?: boolean; salesHead?: string | null;
  };
  try {
    const user = await User.findById(id);
    if (!user || user.userType !== 'sales') {
      return res.status(404).send({ error: 'Salesperson not found' });
    }
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};

    if (typeof partyName === 'string' && partyName.trim()) set.partyName = partyName.trim();

    if (Array.isArray(areas)) {
      const validAreas = areas.filter((a) => AREAS[a]);
      if (validAreas.length === 0) return res.status(400).send({ error: 'Assign at least one area' });
      const { salesRegions, salesBooks } = areasToScope(validAreas);
      set.salesAreas = validAreas; set.salesRegions = salesRegions; set.salesBooks = salesBooks;
    }

    const willBeHead = typeof readOnly === 'boolean' ? readOnly : !!user.salesReadOnly;
    if (typeof readOnly === 'boolean') set.salesReadOnly = readOnly;

    if (willBeHead) {
      unset.salesHead = ''; // heads never report to a head
    } else if (salesHead !== undefined) {
      if (salesHead) {
        if (salesHead === user.username) return res.status(400).send({ error: 'A salesperson cannot report to themselves' });
        const head = await User.findOne({ username: salesHead, userType: 'sales', salesReadOnly: true });
        if (!head) return res.status(400).send({ error: 'Selected sales head not found' });
        set.salesHead = salesHead;
      } else {
        unset.salesHead = '';
      }
    }

    const ops: Record<string, unknown> = {};
    if (Object.keys(set).length) ops.$set = set;
    if (Object.keys(unset).length) ops.$unset = unset;
    const updated = Object.keys(ops).length ? await User.findByIdAndUpdate(id, ops, { new: true }) : user;
    res.send(updated);
  } catch (error) {
    res.status(400).send({ error: 'Could not update the sales user' });
  }
};

export { getAllUsers, addUser, addSalesUser, updateSalesUser, getSalesAreas, deleteUser, blockUser, resetPassword, getPointsConversion, updatePointsConversion, changeUserTier, getTierBillingRequirements, updateTierBillingRequirements, refreshUserList, getTierReview, applyTierReview, updateDealer };
