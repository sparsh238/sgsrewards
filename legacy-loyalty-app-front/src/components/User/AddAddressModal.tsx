import React, { useState } from 'react';
import { Address } from '../../interfaces/AddressInterface';
import { useAddresses } from '../../contexts/AddressContext';
import './AddAddressModal.css';

interface AddAddressModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Added props for modal control
const AddAddressModal: React.FC<AddAddressModalProps> = ({ isOpen, onClose }) => {
    const [address, setAddress] = useState<Partial<Address>>({ default: false, state: 'Rajasthan', country: 'India' });
    const { addAddress } = useAddresses();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setAddress({ ...address, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await addAddress(address as Address);
        onClose();  // Close modal after adding address
    };

    if (!isOpen) return null;  // Do not render if not open

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <form onSubmit={handleSubmit} className="add-address-form">
                    <input name="addressLine1" placeholder="Address Line 1" onChange={handleChange} required />
                    <input name="addressLine2" placeholder="Address Line 2" onChange={handleChange} />
                    <input name="city" placeholder="City" onChange={handleChange} required />
                    <input name="state" placeholder="State" value="Rajasthan" readOnly />
                    <input name="country" placeholder="Country" value="India" readOnly />
                    <input name="pinCode" placeholder="Pin Code" onChange={handleChange} required />
                    <span className='address-default-text'>Set this as default address</span>
                    <select name="default" onChange={handleChange} required>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                    </select>
                    <button type="submit">Add Address</button>
                    <button type="button" onClick={onClose}>Close</button>
                </form>
            </div>
        </div>
    );
};

export default AddAddressModal;
