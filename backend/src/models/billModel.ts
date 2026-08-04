import mongoose, { Document, Schema } from 'mongoose';

export interface Bill extends Document {
    userId: mongoose.Types.ObjectId;
    billNumber: string;
    billDate: Date;
    billAmount: number;
    pointsAwarded: number;
    tierAtBill: string;
    period: string;
    source: string;
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
    // The TRUE billing month, "YYYY-MM". Tier evaluation runs on this (not the
    // entry date) so a back-dated bill lands in the month it belongs to. Derived
    // from billDate on add/edit; the daily push must set billDate to the invoice date.
    period: { type: String, default: '', index: true },
    // Where the bill came from: 'manual' (admin-entered) or 'busy' (daily Busy
    // push sync). The sync only ever touches its own 'busy' bills — manual bills
    // are never clobbered. One 'busy' bill per (userId, period).
    source: { type: String, default: 'manual', index: true },
});

export default mongoose.model<Bill>('Bill', BillSchema);
