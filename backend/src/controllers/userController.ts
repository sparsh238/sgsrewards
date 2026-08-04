import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/userModel';
import Address from '../models/addressModel';
import OrderModel from '../models/orderModel';
import Item from '../models/itemModel';
import { isValidPin } from './authController';

const getUserProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id).populate('savedAddresses orders cart.items.itemId');
    res.send(user);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Parse a date-ish input to a Date or null (blank/invalid -> null).
const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
};

// First-login profile capture. First/last name + DOB are required; anniversary
// is optional. Flips profileCompleted so the gate won't show again.
const completeProfile = async (req: Request, res: Response) => {
  const { firstName, lastName, dateOfBirth, anniversaryDate } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).send({ error: 'First and last name are required' });
  }
  const dob = toDate(dateOfBirth);
  if (!dob) return res.status(400).send({ error: 'A valid date of birth is required' });
  try {
    req.user.firstName = firstName.trim();
    req.user.lastName = lastName.trim();
    req.user.dateOfBirth = dob;
    req.user.anniversaryDate = toDate(anniversaryDate);
    req.user.profileCompleted = true;
    await req.user.save();
    res.send(req.user);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Later profile edits. Only DOB and anniversary are editable by the dealer;
// name/phone/GST are SGS-controlled and ignored here.
const updateProfile = async (req: Request, res: Response) => {
  const { dateOfBirth, anniversaryDate } = req.body;
  try {
    if (dateOfBirth !== undefined) {
      const dob = toDate(dateOfBirth);
      if (!dob) return res.status(400).send({ error: 'A valid date of birth is required' });
      req.user.dateOfBirth = dob;
    }
    if (anniversaryDate !== undefined) req.user.anniversaryDate = toDate(anniversaryDate);
    await req.user.save();
    res.send(req.user);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Dealer acknowledges the quarterly tier-welcome so it won't show again until
// the next tier change.
const markTierWelcomeSeen = async (req: Request, res: Response) => {
  try {
    req.user.tierWelcomeSeen = true;
    await req.user.save();
    res.send({ tierWelcomeSeen: true });
  } catch (error) {
    res.status(500).send(error);
  }
};

const addUserAddress = async (req: Request, res: Response) => {
  const { addressLine1, addressLine2, city, state, country, pinCode } = req.body;

  try {
    const address = new Address({ userId: req.user._id, addressLine1, addressLine2, city, state, country, pinCode });
    await address.save();

    req.user.savedAddresses.push(address._id);
    await req.user.save();

    res.status(201).send(address);
  } catch (error) {
    res.status(500).send(error);
  }
};

const getUserAddresses = async (req: Request, res: Response) => {
  try {
    const addresses = await Address.find({ userId: req.user._id });
    res.send(addresses);
  } catch (error) {
    res.status(500).send(error);
  }
};

const setDefaultAddress = async (req: Request, res: Response) => {
    const { addressId } = req.body;
  
    try {
      const address = await Address.findById(addressId);
      if (!address) {
        return res.status(404).send({ error: 'Address not found' });
      }

      // Ownership check: a user may only default their own address.
      if (address.userId.toString() !== req.user._id.toString()) {
        return res.status(403).send({ error: 'Unauthorized' });
      }

      // Set all other addresses for this user to default: false
      await Address.updateMany(
        { userId: req.user._id, default: true },
        { $set: { default: false } }
      );
  
      // Set the selected address to default: true
      address.default = true;
      await address.save();
  
      res.status(200).send({ message: 'Default address updated successfully', address });
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).send({ error: error.message });
      } else {
        res.status(500).send({ error: 'An unknown error occurred' });
      }
    }
  };

  const editUserAddress = async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const { addressLine1, addressLine2, city, state, country, pinCode, default: isDefault } = req.body;
  
    try {
      const address = await Address.findById(addressId);
      if (!address) {
        return res.status(404).send({ error: 'Address not found' });
      }
  
      // Check if the address belongs to the user
      if (address.userId.toString() !== req.user._id.toString()) {
        return res.status(403).send({ error: 'Unauthorized' });
      }
  
      address.addressLine1 = addressLine1 || address.addressLine1;
      address.addressLine2 = addressLine2 || address.addressLine2;
      address.city = city || address.city;
      address.state = state || address.state;
      address.country = country || address.country;
      address.pinCode = pinCode || address.pinCode;
  
      if (isDefault) {
        // Set all other addresses for this user to default: false
        await Address.updateMany(
          { userId: req.user._id, default: true },
          { $set: { default: false } }
        );
        address.default = true;
      }
  
      await address.save();
  
      res.status(200).send({ message: 'Address updated successfully', address });
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).send({ error: error.message });
      } else {
        res.status(500).send({ error: 'An unknown error occurred' });
      }
    }
  };
  
  const deleteUserAddress = async (req: Request, res: Response) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.addressId;
  
      // Find the address
      const address = await Address.findById(addressId);
      if (!address) {
        return res.status(404).send({ error: 'Address not found' });
      }

      // Ownership check: a user may only delete their own address.
      if (address.userId.toString() !== userId.toString()) {
        return res.status(403).send({ error: 'Unauthorized' });
      }

      // Remove the address from the user's saved addresses
      await User.findByIdAndUpdate(userId, { $pull: { savedAddresses: addressId } });
  
      // Delete the address
      await Address.deleteOne({ _id: addressId });
  
      res.send({ message: 'Address deleted successfully' });
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).send({ error: error.message });
      } else {
        res.status(500).send({ error: 'An unknown error occurred' });
      }
    }
  };

const getUserPoints = async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
      res.send({ availablePoints: user.availablePoints, totalPoints: user.totalPoints });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const getUserOrders = async (req: Request, res: Response) => {
    try {
      const filter: Record<string, unknown> = { userId: req.user._id };
      const status = req.query.status as string | undefined;
      if (status && status !== 'All') filter.status = status;

      // Legacy callers (no ?page) get the plain array; paginated callers get an
      // envelope with the total for chip counts and page controls.
      const pageRaw = req.query.page as string | undefined;
      if (pageRaw === undefined) {
        const orders = await OrderModel.find(filter).populate('items.itemId').sort({ createdAt: -1 });
        return res.send(orders);
      }
      const page = Math.max(1, parseInt(pageRaw, 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));
      const [items, total] = await Promise.all([
        OrderModel.find(filter).populate('items.itemId').sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        OrderModel.countDocuments(filter),
      ]);
      res.send({ items, total, page, pageSize });
    } catch (error) {
      res.status(500).send(error);
    }
  };

const addToCart = async (req: Request, res: Response) => {
    const { itemId, quantity }: { itemId: string; quantity: number } = req.body;

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).send({ error: 'Quantity must be a positive integer' });
    }

    try {
      const item = await Item.findById(itemId);
      if (!item) {
        return res.status(404).send({ error: 'Item not found' });
      }

      // Stock is not tracked (gifts are procured per order) — only availability matters.
      if (item.isActive === false) {
        return res.status(400).send({ error: 'This item is currently unavailable' });
      }

      const cartItem = req.user.cart.items.find((item: { itemId: string }) => item.itemId.toString() === itemId);
      if (cartItem) {
        cartItem.quantity += quantity;
      } else {
        req.user.cart.items.push({ itemId, quantity });
      }
  
      await req.user.save();
      res.send(req.user.cart);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).send({ error: error.message });
      } else {
        res.status(500).send({ error: 'An unknown error occurred' });
      }
    }
  };

const viewCart = async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.user._id).populate('cart.items.itemId');
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
      res.send(user.cart);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const removeFromCart = async (req: Request, res: Response) => {
    const itemId = req.params.itemId;  // Use the itemId directly from params

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }

        const cartItemIndex = user.cart.items.findIndex((item) => item.itemId.toString() === itemId);
        if (cartItemIndex === -1) {
            return res.status(404).send({ error: 'Item not found in cart' });
        }

        user.cart.items.splice(cartItemIndex, 1);
        await user.save();

        res.send(user.cart);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).send({ error: error.message });
        } else {
            res.status(500).send({ error: 'An unknown error occurred' });
        }
    }
  };

  const updateCartItem = async (req: Request, res: Response) => {
    const { itemId, quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).send({ error: 'Quantity must be a positive integer' });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }

        const cartItem = user.cart.items.find(item => item.itemId.toString() === itemId);
        if (!cartItem) {
            return res.status(404).send({ error: 'Item not found in cart' });
        }

        cartItem.quantity = quantity;
        await user.save();

        res.send(user.cart);
    } catch (error) {
        res.status(500).send({ error: error });
    }
  };

  const checkout = async (req: Request, res: Response) => {
    const { addressId, items }: { addressId: string, items?: { itemId: string; quantity: number }[] } = req.body;
  
    try {
      // Address is optional — the distribution house fulfils orders offline, so
      // dealers no longer pick one. If an addressId is supplied (e.g. the old
      // app), validate it and check ownership; otherwise the order has none.
      let address = null;
      if (addressId) {
        address = await Address.findById(addressId);
        if (!address) {
          return res.status(404).send({ error: 'Address not found' });
        }
        if (address.userId.toString() !== req.user._id.toString()) {
          return res.status(403).send({ error: 'Unauthorized' });
        }
      }

      // Determine the raw items to checkout: either the ones passed in the body
      // (direct "Buy Now") or the user's saved cart. Cart items are stored as
      // plain { itemId, quantity } and are NOT populated by the auth middleware,
      // so both paths must resolve full item details before pricing.
      const rawItems: { itemId: string; quantity: number }[] =
        items && items.length
          ? items
          : req.user.cart.items.map((ci: { itemId: any; quantity: number }) => ({
              itemId: ci.itemId.toString(),
              quantity: ci.quantity,
            }));

      if (!rawItems.length) {
        return res.status(400).send({ error: 'No items to checkout' });
      }

      const itemsToCheckout = await Promise.all(rawItems.map(async (item) => {
        const itemDetails = await Item.findById(item.itemId);
        if (!itemDetails) {
          throw new Error(`Item with ID ${item.itemId} not found`);
        }
        // Stock is not tracked (gifts are procured per order); hidden items
        // cannot be ordered.
        if (itemDetails.isActive === false) {
          throw new Error(`${itemDetails.name} is currently unavailable`);
        }
        return {
          itemId: item.itemId,
          quantity: item.quantity,
          itemIdDetails: itemDetails
        };
      }));

      // Calculate the total value of the items (discount is optional in the schema)
      const totalValue = itemsToCheckout.reduce(
        (acc, item) =>
          acc + item.quantity * (item.itemIdDetails.pointsRequired - (item.itemIdDetails.discount ?? 0)),
        0
      );

      const fromCart = !(items && items.length);

      // Fast, non-authoritative pre-check. The atomic guard below is the real one.
      if (totalValue > req.user.availablePoints) {
        return res.status(400).send({ error: 'Insufficient balance' });
      }

      // Atomically deduct points, but only if the balance still covers the order.
      const debited = await User.findOneAndUpdate(
        { _id: req.user._id, availablePoints: { $gte: totalValue } },
        { $inc: { availablePoints: -totalValue } },
        { new: true }
      );
      if (!debited) {
        return res.status(400).send({ error: 'Insufficient balance' });
      }

      // Create the order. The pre('validate') hook assigns a unique orderIdAlias.
      let newOrder;
      try {
        newOrder = new OrderModel({
          userId: req.user._id,
          items: itemsToCheckout,
          totalValue,
          status: 'Pending',
          ...(address ? { address: address._id } : {}),
        });
        await newOrder.save();
      } catch (orderErr) {
        // Compensate: refund the points.
        await User.updateOne({ _id: req.user._id }, { $inc: { availablePoints: totalValue } });
        throw orderErr;
      }

      // Record the order on the user, and clear the cart if this was a cart checkout.
      const userUpdate: any = { $push: { orders: newOrder._id } };
      if (fromCart) {
        userUpdate.$set = { 'cart.items': [] };
      }
      await User.updateOne({ _id: req.user._id }, userUpdate);

      res.status(201).send(newOrder);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).send({ error: error.message });
      } else {
        res.status(500).send({ error: 'An unknown error occurred' });
      }
    }
};

const changePassword = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id); // Assuming the user is authenticated
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).send({ error: 'New password is required' });
    }

    user.password = await bcrypt.hash(newPassword, 8);
    user.isPasswordReset = true; // Mark password as reset
    await user.save();

    res.status(200).send({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error updating password' });
  }
};

// Dealer sets their own 4-digit PIN (on first login, or after a superadmin reset).
const setPin = async (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!isValidPin(pin)) {
    return res.status(400).send({ error: 'PIN must be exactly 4 digits' });
  }
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    user.password = await bcrypt.hash(pin, 8);
    user.isPasswordReset = true; // dealer has now chosen their own PIN
    await user.save();
    res.status(200).send({ message: 'PIN set successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error setting PIN' });
  }
};

export { getUserProfile, completeProfile, updateProfile, markTierWelcomeSeen, addUserAddress, getUserAddresses, setDefaultAddress, editUserAddress, deleteUserAddress, getUserPoints, getUserOrders, addToCart, viewCart, removeFromCart, updateCartItem, checkout, changePassword, setPin };
