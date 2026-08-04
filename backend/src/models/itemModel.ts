import { Schema, model, Document } from 'mongoose';

interface Item extends Document {
  name: string;
  images: string[];
  description: string;
  pointsRequired: number;
  /** Legacy field — stock is no longer tracked (gifts are procured per order).
   *  Kept optional so existing documents and the old admin app stay valid. */
  stock?: number;
  discount?: number;
  /** Availability switch: hidden items stay in the catalog (images, history)
   *  but can't be seen or ordered by dealers. */
  isActive: boolean;
}

const itemSchema = new Schema<Item>({
  name: { type: String, required: true },
  images: [{ type: String }],
  description: { type: String },
  pointsRequired: { type: Number, required: true },
  stock: { type: Number },
  discount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

export default model<Item>('Item', itemSchema);
