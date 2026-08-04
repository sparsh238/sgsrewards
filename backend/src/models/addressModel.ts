import { Schema, model, Document, ObjectId } from 'mongoose';

interface Address extends Document {
  userId: ObjectId;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  default: boolean;
}

const addressSchema = new Schema<Address>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  pinCode: { type: String, required: true },
  default: { type: Boolean, default: false }
});

export default model<Address>('Address', addressSchema);
