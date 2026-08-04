import { Schema, model, Document, ObjectId } from 'mongoose';

interface OrderItem {
  itemId: ObjectId;
  quantity: number;
}

interface Order extends Document {
  userId: ObjectId;
  items: OrderItem[];
  totalValue: number;
  orderDate: Date;
  status: 'Pending' | 'Completed' | 'Cancelled';
  address?: ObjectId; // optional — dealers no longer pick a delivery address
  orderIdAlias: string; // New field
}

const orderSchema = new Schema<Order>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      quantity: { type: Number, required: true }
    }
  ],
  totalValue: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' },
  address: { type: Schema.Types.ObjectId, ref: 'Address' },
  orderIdAlias: { type: String, required: true, unique: true } // New field
});

// Generate a unique orderIdAlias before validation, so the required field is
// populated by the time schema validation runs (pre-'save' runs after validate).
orderSchema.pre('validate', async function (next) {
  const order = this as Order; // Type assertion
  if (order.isNew && !order.orderIdAlias) {
    let uniqueAlias = false;
    while (!uniqueAlias) {
      const randomId = generateOrderIdAlias();
      const existingOrder = await OrderModel.findOne({ orderIdAlias: randomId }); // Use the correct model reference
      if (!existingOrder) {
        order.orderIdAlias = randomId;
        uniqueAlias = true;
      }
    }
  }
  next();
});

// Function to generate a random orderIdAlias
function generateOrderIdAlias() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = letters.charAt(Math.floor(Math.random() * letters.length)) + letters.charAt(Math.floor(Math.random() * letters.length));
  const randomNumbers = Math.floor(Math.random() * 900) + 100; // Generates a number between 100 and 999
  return randomLetters + randomNumbers;
}

const OrderModel = model<Order>('Order', orderSchema); // Rename the default export

export default OrderModel;
