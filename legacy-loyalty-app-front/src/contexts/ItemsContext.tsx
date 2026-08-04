import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface Item {
    _id: string;
    name: string;
    image: string;
    description: string;
    pointsRequired: number;
    stock: number;
}

interface ItemsContextType {
    items: Item[];
    fetchItems: () => Promise<void>;
}

const ItemsContext = createContext<ItemsContextType | null>(null);

export const ItemsProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [items, setItems] = useState<Item[]>([]);

    const fetchItems = async () => {
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/item');
            if (!response.ok) {
                throw new Error('Failed to fetch items');
            }
            const data = await response.json();
            setItems(data); // Ensure that the data format matches your Item[] type
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    };

    // Fetch items when the provider mounts
    useEffect(() => {
        fetchItems();
    }, []);

    return (
        <ItemsContext.Provider value={{ items, fetchItems }}>
            {children}
        </ItemsContext.Provider>
    );
};

export const useItems = () => {
    const context = useContext(ItemsContext);
    if (!context) {
        throw new Error('useItems must be used within an ItemsProvider');
    }
    return context;
};
