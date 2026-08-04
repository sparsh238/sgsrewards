import React, { useState, useEffect } from 'react';
import './BuyNow.css';
import { useAddresses } from '../../contexts/AddressContext';
import fetchUserPoints from '../../utils/fetchUserPoints';
import apiFetch from '../../utils/apiFetch';
import AddAddressModal from './AddAddressModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaLocationArrow, FaTrash } from 'react-icons/fa';
import { formatNumber, parseFormattedNumber } from '../../utils/formatNumber';

const BuyNow: React.FC = () => {
    const [item, setItem] = useState<any>(null);
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [isAddressListModalOpen, setIsAddressListModalOpen] = useState(false);
    const [orderStatus, setOrderStatus] = useState<string>('');
    const [availablePoints, setAvailablePoints] = useState<number>(0);
    const { addresses, fetchAddresses, deleteAddress } = useAddresses();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const loadPoints = async () => {
            try {
                const points = await fetchUserPoints();
                setAvailablePoints(points.availablePoints);
            } catch (error) {
                console.error('Failed to load points:', error);
            }
        };

        loadPoints();
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, []);

    useEffect(() => {
        if (addresses.length > 0) {
            const defaultAddress = addresses.find(address => address.default);
            setSelectedAddress(defaultAddress?._id || addresses[0]._id);
        }
    }, [addresses]);

    useEffect(() => {
        const selectedItem = location.state?.item;
        if (selectedItem) {
            setItem(selectedItem);
        } else {
            navigate('/user/shop');
        }
    }, [location, navigate]);

    const handleAddressChange = (id: string) => {
        setSelectedAddress(id);
        setIsAddressListModalOpen(false);
    };

    const handleDeleteAddress = async (addressId: string) => {
        try {
            await deleteAddress(addressId);
            if (selectedAddress === addressId) {
                setSelectedAddress(addresses[0]?._id || null);
            }
        } catch (error) {
            console.error('Failed to delete address:', error);
        }
    };

    const placeOrder = async () => {
        if (!selectedAddress) {
            setOrderStatus('Please select a delivery address');
            return;
        }

        const requestBody = {
            addressId: selectedAddress,
            items: [{ itemId: item._id, quantity: 1 }]
        };

        try {
            const response = await apiFetch('/api/user/cart/checkout', {
                method: 'POST',
                json: requestBody
            });

            const responseData = await response.json();

            if (response.status === 201) {
                setOrderStatus('Order Placed');
                navigate('/thank-you', { state: { remainingPoints: availablePoints - totalCost } });
            } else {
                setOrderStatus('Order Failed ' + responseData.error);
            }
        } catch (error) {
            console.error('Order placement failed:', error);
            setOrderStatus('Order Failed');
        }
    };

    if (!item) return null;

    const itemPrice = parseFormattedNumber(item.pointsRequired) - item.discount;
    const totalCost = itemPrice;
    const remainingPoints = availablePoints - totalCost;
    const hasInsufficientPoints = remainingPoints < 0;

    return (
        <div>
            <div className="buy-now-container">
                <div className="total-points">
                    <span>Total: <b>{formatNumber(totalCost)}</b> Points</span>
                </div>
                <div className="address-bar" onClick={() => setIsAddressListModalOpen(true)}>
                    {selectedAddress ? (
                        <div>
                            <span>Delivered to:</span>
                            <p>
                                <FaLocationArrow size={15} />
                                {addresses.find(address => address._id === selectedAddress)?.addressLine1}, {addresses.find(address => address._id === selectedAddress)?.addressLine2}, {addresses.find(address => address._id === selectedAddress)?.city}, {addresses.find(address => address._id === selectedAddress)?.state}, {addresses.find(address => address._id === selectedAddress)?.country}, {addresses.find(address => address._id === selectedAddress)?.pinCode}
                            </p>
                            <button>Change Address</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsAddressModalOpen(true)}>Add Address</button>
                    )}
                </div>
                {isAddressListModalOpen && (
                    <div className="address-modal">
                        <div className="address-modal-content">
                            <h3>Select Address</h3>
                            {addresses.map(address => (
                                <div key={address._id} className="address-item">
                                    <label htmlFor={address._id} onClick={() => handleAddressChange(address._id)}>
                                        {address.addressLine1}, {address.addressLine2}, {address.city}, {address.state}, {address.country}, {address.pinCode}
                                    </label>
                                    <FaTrash
                                        className="delete-icon"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevents the label click event from firing
                                            handleDeleteAddress(address._id);
                                        }}
                                    />
                                </div>
                            ))}
                            <button onClick={() => setIsAddressModalOpen(true)}>Add New Address</button>
                            <button onClick={() => setIsAddressListModalOpen(false)}>Close</button>
                        </div>
                    </div>
                )}
                {isAddressModalOpen && (
                    <AddAddressModal
                        isOpen={isAddressModalOpen}
                        onClose={() => setIsAddressModalOpen(false)}
                    />
                )}
                <button onClick={placeOrder} disabled={hasInsufficientPoints || orderStatus === 'Order Placed'} className="place-order-btn">Place Order</button>
                {orderStatus && <p style={{ color: orderStatus === 'Order Placed' ? 'green' : 'red' }}>{orderStatus}</p>}
                <div className="buy-now-item-card">
                    <img src={process.env.REACT_APP_API_URL + `/${item.image}`} alt={item.name} className="buy-now-item-image" />
                    <div className="buy-now-item-details">
                        <h3 className="buy-now-item-name">{item.name}</h3>
                        <p className="buy-now-item-points">{formatNumber(itemPrice)} Points</p>
                    </div>
                </div>
                {hasInsufficientPoints && <p style={{ color: 'red' }}>Insufficient Points</p>}
            </div>
        </div>
    );
};

export default BuyNow;
