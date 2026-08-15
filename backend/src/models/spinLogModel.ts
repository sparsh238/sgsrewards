import { Schema, model, Types } from 'mongoose';

// One row per spin — the audit trail (who spun, what they paid, what they won).
export interface SpinLog {
  userId: Types.ObjectId;
  partyName: string;
  tier: string;
  entryFee: number;
  prize: number;
  segmentIndex: number;
  balanceAfter: number;
  createdAt: Date;
}

const spinLogSchema = new Schema<SpinLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partyName: { type: String, default: '' },
  tier: { type: String, default: '' },
  entryFee: { type: Number, required: true },
  prize: { type: Number, required: true },
  segmentIndex: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default model<SpinLog>('SpinLog', spinLogSchema);
