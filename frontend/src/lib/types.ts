export interface Item {
  _id: string;
  name: string;
  images: string[];
  description?: string;
  pointsRequired: number;
  /** Legacy — stock is not tracked; gifts are procured per order. */
  stock?: number;
  discount?: number;
  /** Hidden items are excluded from the shop and can't be ordered. */
  isActive?: boolean;
}

export const isAvailable = (item: Pick<Item, 'isActive'>): boolean =>
  item.isActive !== false;

/** Effective redeem price in points. */
export const itemPrice = (item: Pick<Item, 'pointsRequired' | 'discount'>): number =>
  item.pointsRequired - (item.discount ?? 0);

export interface CartEntry {
  itemId: Item | null; // populated by the backend; null if the item was deleted
  quantity: number;
}

export interface Address {
  _id: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  default?: boolean;
}

export const addressLabel = (a: Address): string =>
  [a.addressLine1, a.addressLine2, a.city, a.state, a.pinCode].filter(Boolean).join(', ');

export interface Order {
  _id: string;
  orderIdAlias: string;
  totalValue: number;
  orderDate: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  items: { itemId: Pick<Item, 'name'> | null; quantity: number }[];
}
