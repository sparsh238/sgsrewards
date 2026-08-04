import { Schema, model, Document, ObjectId } from 'mongoose';

interface CartItem {
  itemId: ObjectId;
  quantity: number;
}

interface User extends Document {
  username: string;
  partyName:string;
  phoneNumber: string;
  password: string;
  userType: 'customer' | 'admin' | 'superadmin';
  availablePoints: number;
  totalPoints: number;
  savedAddresses: ObjectId[];
  orders: ObjectId[];
  cart: {
    items: CartItem[];
  };
  refreshToken: string | null;
  blocked: boolean;
  tier: 'NoTier' | 'Basic' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  /** Tier before the most recent superadmin change — drives the quarterly welcome. */
  previousTier: 'NoTier' | 'Basic' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | null;
  /** false = the dealer hasn't yet seen the welcome for their latest tier change. */
  tierWelcomeSeen: boolean;
  isPasswordReset: boolean;
  // Dealer profile, captured on first login (anniversary optional). `profileCompleted`
  // is false/absent until the dealer submits the first-login form; existing accounts
  // without the field read as incomplete, so they're prompted on next login.
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date | null;
  anniversaryDate?: Date | null;
  profileCompleted: boolean;
  // Unique business keys / grouping — GSTIN is the join key; region/district drive
  // the admin overview grouping. Set at dealer creation.
  gstin?: string;
  region?: string;
  district?: string;
}

const userSchema = new Schema<User>({
  username: { type: String, required: true },
  partyName:{ type: String, required: true},
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ['customer', 'admin', 'superadmin'] },
  availablePoints: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  savedAddresses: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
  orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  cart: {
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
        quantity: { type: Number }
      }
    ]
  },
  refreshToken: { type: String, default: null },
  blocked: { type: Boolean, default: false },
  tier: { type: String, default: 'NoTier', enum: ['NoTier', 'Basic','Bronze', 'Silver', 'Gold', 'Platinum'] }, // Default tier: Bronze
  previousTier: { type: String, default: null, enum: ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum', null] },
  // Default true so existing dealers don't get a spurious welcome; only a real
  // tier change flips it to false.
  tierWelcomeSeen: { type: Boolean, default: true },
  isPasswordReset: { type: Boolean, default: false },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  dateOfBirth: { type: Date, default: null },
  anniversaryDate: { type: Date, default: null },
  profileCompleted: { type: Boolean, default: false },
  gstin: { type: String, default: '' },
  region: { type: String, default: '' },
  district: { type: String, default: '' },
});

// Never serialize sensitive fields. Applies to res.send/res.json for the User
// document and any populated User subdocuments across every controller.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});

export default model<User>('User', userSchema);
