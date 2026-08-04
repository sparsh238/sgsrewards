import { Schema, model, Document } from 'mongoose';

interface System extends Document {
  pointsConversion: number;
  tierPointsConversion: {
    NoTier: number;
    Basic: number;
    Bronze: number;
    Silver: number;
    Gold: number;
    Platinum: number;
  };
  tierBillingRequirements: {
    Unranked: number;
    Basic: number;
    Bronze: number;
    Silver: number;
    Gold: number;
    Platinum: number;
  };
  // The fiscal-quarter key (e.g. "2026-Q2") the tier review was last applied for,
  // so a quarter can only be run once unless explicitly forced.
  lastTierReviewQuarter?: string;
  lastTierReviewAt?: Date;
}

const systemSchema = new Schema<System>({
  pointsConversion: { type: Number, required: true },
  tierPointsConversion: {
    NoTier: { type: Number, required: true },
    Basic: { type: Number, required: true },
    Bronze: { type: Number, required: true },
    Silver: { type: Number, required: true },
    Gold: { type: Number, required: true },
    Platinum: { type: Number, required: true },
  },
  tierBillingRequirements: {
    NoTier: { type: Number, required: true },
    Basic: { type: Number, required: true },
    Bronze: { type: Number, required: true },
    Silver: { type: Number, required: true },
    Gold: { type: Number, required: true },
    Platinum: { type: Number, required: true },
  },
  lastTierReviewQuarter: { type: String, default: '' },
  lastTierReviewAt: { type: Date, default: null },
});

export default model<System>('System', systemSchema);
