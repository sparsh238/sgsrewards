import mongoose, { Document, Schema } from 'mongoose';

export interface Bill extends Document {
    userId: mongoose.Types.ObjectId;
    billNumber: string;
    billDate: Date;
    billAmount: number;
    pointsAwarded: number;
    tierAtBill: string;
}

const BillSchema: Schema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    billNumber: { type: String, required: true },
    billDate: { type: Date, required: true },
    billAmount: { type: Number, required: true },
    // Points granted for this bill at creation time. Persisted so edit/delete
    // reverse the exact amount originally awarded, even if the user's tier
    // later changes. Legacy bills without this field fall back to recomputation.
    pointsAwarded: { type: Number, default: 0 },
    // The dealer's tier at the moment the bill was recorded — shown in the admin
    // audit so a +0 (NoTier-at-billing) bill is explainable.
    tierAtBill: { type: String, default: '' },
});

export default mongoose.model<Bill>('Bill', BillSchema);
