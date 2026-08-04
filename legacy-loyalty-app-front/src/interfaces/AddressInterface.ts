export interface Address {
    _id: string;
    userId: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
    default: boolean;
}