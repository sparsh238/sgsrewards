import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AddressList from './AddressList';
import ItemDetails from './ItemDetails';
import './CheckoutPage.css';

const CheckoutPage = () => {
    const location = useLocation();
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedAddressId, setSelectedAddressId] = useState('');


    useEffect(() => {
        // Extracting the item directly from location.state
        const itemFromState = location.state?.item;
        if (itemFromState) {
            setSelectedItem(itemFromState);
        } else {
            console.error('No item data provided to CheckoutPage');
        }
    }, [location]);

    return (
        <div className="checkout-page">
            <div className="address-section">
                <AddressList onAddressSelect={setSelectedAddressId} />
            </div>
            <div className="item-details-section">
            {selectedItem ? (
                    <ItemDetails item={selectedItem} selectedAddressId={selectedAddressId} />
                ) : (
                    <p>Loading item details...</p>
                )}
            </div>
        </div>
    );
};

export default CheckoutPage;
