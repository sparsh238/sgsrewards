import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Address } from '../interfaces/AddressInterface';
import { useAuth } from './AuthContext';

interface AddressContextType {
    addresses: Address[];
    fetchAddresses: () => Promise<void>;
    addAddress: (address: Address) => Promise<void>;
    deleteAddress: (addressId: string) => Promise<void>;  // Added deleteAddress method
}

const AddressContext = createContext<AddressContextType | null>(null);

export const AddressProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const { auth } = useAuth();

    const fetchAddresses = async () => {
        const tok = localStorage.getItem('token');
        if (!auth.token) return;
        const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/addresses', {
            headers: { 'Authorization': `Bearer ${tok}` }
        });
        const data = await response.json();
        setAddresses(data);
    };

    const addAddress = async (address: Address) => {
        if (!auth.token) return;
        const tok = localStorage.getItem('token');
        await fetch(process.env.REACT_APP_API_URL + '/api/user/addresses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tok}`
            },
            body: JSON.stringify(address)
        });
        await fetchAddresses(); // Re-fetch addresses
    };

    // New method to delete an address
    const deleteAddress = async (addressId: string) => {
        if (!auth.token) return;
        const tok = localStorage.getItem('token');
        await fetch(process.env.REACT_APP_API_URL + `/api/user/addresses/${addressId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${tok}`
            }
        });
        await fetchAddresses(); // Re-fetch addresses after deletion
    };

    useEffect(() => {
        fetchAddresses();
    }, [auth.token]);

    return (
        <AddressContext.Provider value={{ addresses, fetchAddresses, addAddress, deleteAddress }}>
            {children}
        </AddressContext.Provider>
    );
};

export const useAddresses = () => {
    const context = useContext(AddressContext);
    if (!context) throw new Error("useAddresses must be used within an AddressProvider");
    return context;
}
