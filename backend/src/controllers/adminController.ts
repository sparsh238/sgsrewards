import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/userModel';
import Order from '../models/orderModel';
import Bill from '../models/billModel';
import System from '../models/systemModel';

const TIER_ORDER = ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'];

// Region-grouped dealer status for the overview: each dealer's billing this
// window vs the floor to hold and the requirement to advance, plus a
// promote/hold/at-risk verdict for the target bar.
const getOverview = async (req: Request, res: Response) => {
  try {
    const system = await System.findOne();
    const reqs = (system?.tierBillingRequirements ?? {}) as Record<string, number>;
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date(to).setMonth(to.getMonth() - 3));

    const agg = await Bill.aggregate([
      { $match: { billDate: { $gte: from, $lt: to } } },
      { $group: { _id: '$userId', billed: { $sum: '$billAmount' } } },
    ]);
    const billedByUser = new Map<string, number>(agg.map((a) => [String(a._id), a.billed]));
    const dealers = await User.find({ userType: 'customer' });

    let promoting = 0, atRisk = 0;
    const byRegion: Record<string, any> = {};
    for (const u of dealers) {
      const billed = billedByUser.get(String(u._id)) ?? 0;
      const idx = TIER_ORDER.indexOf(u.tier);
      const floor = reqs[u.tier] ?? 0;
      const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
      const nextReq = nextTier ? reqs[nextTier] ?? null : null;
      let status: 'promoting' | 'holds' | 'atRisk' = 'holds';
      if (nextReq != null && billed >= nextReq) status = 'promoting';
      else if (u.tier !== 'NoTier' && billed < floor) status = 'atRisk';
      if (status === 'promoting') promoting++;
      if (status === 'atRisk') atRisk++;
      const target = nextReq ?? floor ?? 1;
      const progress = Math.min(100, Math.round((billed / (target || 1)) * 100));
      const region = u.region || 'Unassigned';
      (byRegion[region] ??= { region, dealers: [], billed: 0 });
      byRegion[region].dealers.push({
        partyName: u.partyName, tier: u.tier, billed, floor, nextTier, nextReq, status, progress,
      });
      byRegion[region].billed += billed;
    }
    const regions = Object.values(byRegion)
      .map((r: any) => ({ ...r, count: r.dealers.length, dealers: r.dealers.sort((a: any, b: any) => b.billed - a.billed) }))
      .sort((a: any, b: any) => b.count - a.count);

    res.send({ from, to, totals: { dealers: dealers.length, promoting, atRisk }, regions });
  } catch (error) {
    res.status(500).send({ error: 'Failed to build overview' });
  }
};

const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ userType: 'customer' });
    res.send(users);
  } catch (error) {
    res.status(500).send(error);
  }
};

const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).populate('orders savedAddresses');
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    res.send(user);
  } catch (error) {
    res.status(500).send(error);
  }
};

const addCustomer = async (req: Request, res: Response) => {
  const { partyName, phoneNumber } = req.body;
  // Dealers log in by phone; `username` is auto-set (kept only as an internal
  // field). The secret is a 4-digit temp PIN (`pin`), falling back to the old
  // `password` field for backwards compatibility with the previous app.
  const pin = req.body.pin ?? req.body.password;
  const username = req.body.username || phoneNumber;

  if (!partyName || !phoneNumber || !pin) {
    return res.status(400).send({ error: 'Party name, phone number and PIN are required' });
  }
  if (!/^\d{4}$/.test(String(pin))) {
    return res.status(400).send({ error: 'PIN must be exactly 4 digits' });
  }

  try {
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      return res.status(400).send({ error: 'A dealer with this phone number already exists' });
    }

    const hashedPassword = await bcrypt.hash(String(pin), 8);
    const user = new User({
      username,
      partyName,
      phoneNumber,
      password: hashedPassword,
      userType: 'customer',
      availablePoints: req.body.availablePoints || 0,
      totalPoints: req.body.totalPoints || 0,
      isPasswordReset: false, // forces the dealer to set their own PIN at first login
    });
    await user.save();
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send(error);
  }
};

const addCustomers = async (req: Request, res: Response) => {
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).send({ error: 'Users array is required and cannot be empty' });
  }

  try {
      const hashedUsers = await Promise.all(users.map(async (user) => {
          if (!user.username || !user.phoneNumber || !user.password || !user.partyName) {
              throw new Error('Username, phone number, and password are required for all users');
          }

          const hashedPassword = await bcrypt.hash(user.password, 8);
          return {
              username: user.username,
              partyName: user.partyName,
              phoneNumber: user.phoneNumber,
              password: hashedPassword,
              userType: 'customer',
              availablePoints: user.availablePoints || 0,
              totalPoints: user.totalPoints || 0,
              savedAddresses: user.savedAddresses || [],
              orders: user.orders || [],
              refreshToken: user.refreshToken || null,
              blocked: user.blocked || false,
              // dateOfBirth: user.dateOfBirth, // If you want to include dateOfBirth, uncomment this line
          };
      }));

      const newUsers = await User.insertMany(hashedUsers);
      res.status(201).json(newUsers);
  } catch (error) {
      res.status(500).send({ error: error });
  }
};

const getOrders = async (req: Request, res: Response) => {
  try {
      const orders = await Order.find()
          .populate({ path: 'userId', select: 'partyName phoneNumber' })
          .populate({ path: 'items.itemId', select: 'name' })
          .populate({ path: 'address' });
      
      res.send(orders);
  } catch (error) {
      res.status(500).send(error);
  }
};

const getOrderById = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
      const order = await Order.findById(orderId)
          .populate({ path: 'userId', select: 'partyName phoneNumber' })
          .populate({ path: 'items.itemId', select: 'name' })
          .populate({ path: 'address' });

      if (!order) {
          return res.status(404).send({ error: 'Order not found' });
      }

      // A customer may only read their own orders; admins/superadmins read any.
      if (req.user.userType === 'customer') {
          const ownerId = (order.userId && (order.userId as any)._id) || order.userId;
          if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
              return res.status(403).send({ error: 'Unauthorized' });
          }
      }

      res.send(order);
  } catch (error) {
      res.status(500).send(error);
  }
};

const updateOrderStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!['Pending', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).send({ error: 'Invalid status' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send({ error: 'Order not found' });
    }

    // If the status is being changed to "Cancelled", refund the points
    // atomically. Guarded by the status check so a re-cancel is a no-op.
    // (Stock is not tracked — gifts are procured per order.)
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      await User.updateOne(
        { _id: order.userId },
        { $inc: { availablePoints: order.totalValue } }
      );
    }

    // Update the order status
    order.status = status;
    await order.save();

    res.send(order);
  } catch (error) {
    res.status(500).send({ error: 'Internal server error', details: error });
  }
};

export { getUsers, getUserById, addCustomer, addCustomers, getOrders, getOrderById, updateOrderStatus, getOverview };
