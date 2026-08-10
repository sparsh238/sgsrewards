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
    locked: boolean;
    voided: boolean;
    excluded: boolean;
    lineItems: Array<{ item: string; group: string; brand: string; category: string; qty: number; value: number }>;
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
    // are never clobbered. One 'busy' bill per (userId, billNumber, period), where
    // billNumber is the Busy voucher number — i.e. one bill per real invoice, not
    // one per month. billDate is the actual invoice date, falling back to
    // `${period}-01` when the voucher carries no date.
    source: { type: String, default: 'manual', index: true },
    // Admin took manual control of a synced bill (edited it). The Busy sync then
    // leaves it entirely alone — it won't overwrite the amount/points or reverse
    // it if the underlying voucher later vanishes. No effect on manual bills.
    locked: { type: Boolean, default: false },
    // Soft-delete. Set when an admin deletes a synced ('busy') bill: the points
    // are reversed and the row is hidden from every list, but it survives so the
    // idempotent sync can't re-create it from the still-present Busy voucher.
    // Manual bills are hard-deleted instead and never carry this.
    voided: { type: Boolean, default: false },
    // Admin chose to DISREGARD this bill: it awards 0 points AND is left out of
    // tier-turnover totals (the overview/dealer aggregations filter it out). The
    // row stays for the record, tagged "excluded". Reversible.
    excluded: { type: Boolean, default: false },
    // Item-wise breakdown from the Busy invoice (synced bills only). One entry per
    // stock line: model, product group, brand, category, quantity and line value.
    // Lets the admin see exactly what went into a bill before deciding on points.
    lineItems: {
        type: [{
            item: String, group: String, brand: String, category: String,
            qty: Number, value: Number,
            _id: false,
        }],
        default: undefined,
    },
});

export default mongoose.model<Bill>('Bill', BillSchema);
