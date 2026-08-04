export interface OrderItem {
    itemId: {
        _id: string;
        name: string;
    };
    quantity: number;
}

export interface Order {
    _id: string;
    orderIdAlias: string;
    userId: {
        _id: string;
        username: string;
    };
    items: OrderItem[];
    totalValue: number;
    orderDate: Date;
    status: 'Pending' | 'Completed' | 'Cancelled';
    address: {
        _id: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        country: string;
        pinCode: string;
    };

}
