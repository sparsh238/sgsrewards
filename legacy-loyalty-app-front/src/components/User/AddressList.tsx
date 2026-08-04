import React, { useState, useEffect } from 'react';
import { useAddresses } from '../../contexts/AddressContext';
import AddAddressModal from './AddAddressModal';
import './AddressList.css';

interface AddressListProps {
    onAddressSelect: (id: string) => void;  // New prop for callback
}

const AddressList: React.FC<AddressListProps> = ({ onAddressSelect }) => {
    const { addresses } = useAddresses();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState('');

    // Effect to set default address on initial load or when addresses change
    useEffect(() => {
        const defaultAddress = addresses.find(address => address.default);
        if (defaultAddress) {
            setSelectedAddressId(defaultAddress._id);
            onAddressSelect(defaultAddress._id);
        }
    }, [addresses]);

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleAddressChange = (id: string) => {
        setSelectedAddressId(id);
        onAddressSelect(id);
        // Optionally update the default address in your context or server
    };

    return (
        <div className="address-list">
            {addresses.map((address) => (
                <div key={address._id} className="address-entry">
                    <label>
                        <input
                            type="radio"
                            name="address"
                            value={address._id}
                            checked={selectedAddressId === address._id}
                            onChange={() => handleAddressChange(address._id)}
                        />
                        {`${address.addressLine1}, ${address.addressLine2}, ${address.city}, ${address.state}, ${address.country}, ${address.pinCode}`}
                    </label>
                </div>
            ))}
            <button onClick={handleOpenModal} className="add-address-button">Add New Address</button>
            <AddAddressModal isOpen={isModalOpen} onClose={handleCloseModal} />
        </div>
    );
};

export default AddressList;
