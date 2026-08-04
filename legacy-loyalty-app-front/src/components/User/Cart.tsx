import React, { useState, useEffect } from 'react';
import './Cart.css';
import { useAddresses } from '../../contexts/AddressContext';
import fetchUserPoints from '../../utils/fetchUserPoints';
import AddAddressModal from './AddAddressModal';
import { useNavigate } from 'react-router-dom';
import { FaLocationArrow, FaTrash } from 'react-icons/fa';
import { formatNumber } from '../../utils/formatNumber';

const Cart: React.FC = () => {
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [isAddressListModalOpen, setIsAddressListModalOpen] = useState(false);
    const [orderStatus, setOrderStatus] = useState<string>('');
    const [availablePoints, setAvailablePoints] = useState<number>(0);
    const { addresses, fetchAddresses, deleteAddress } = useAddresses();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCartItems = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/cart', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                setCartItems(data.items);
            } catch (error) {
                console.error('Error fetching cart items:', error);
            }
        };

        fetchCartItems();
    }, []);

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

    const handleQuantityChange = async (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        const updatedItems = cartItems.map(item =>
            item.itemId._id === itemId ? { ...item, quantity } : item
        );
        setCartItems(updatedItems);

        const token = localStorage.getItem('token');
        try {
            await fetch(process.env.REACT_APP_API_URL + '/api/user/cart/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ itemId, quantity })
            });
        } catch (error) {
            console.error('Error updating cart item quantity:', error);
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        const updatedItems = cartItems.filter(item => item.itemId._id !== itemId);
        setCartItems(updatedItems);

        const token = localStorage.getItem('token');
        try {
            await fetch(process.env.REACT_APP_API_URL + `/api/user/cart/remove/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Error removing cart item:', error);
        }
    };

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
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Authentication token not found');
            setOrderStatus('Authentication required');
            return;
        }

        const requestBody = {
            addressId: selectedAddress,
            items: cartItems.map(item => ({ itemId: item.itemId._id, quantity: item.quantity }))
        };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/cart/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
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

    const totalCost = cartItems.reduce((total, item) => {
        const itemPrice = item.itemId.pointsRequired - item.itemId.discount;
        return total + itemPrice * item.quantity;
    }, 0);

    const remainingPoints = availablePoints - totalCost;
    const hasInsufficientPoints = remainingPoints < 0;
    const isCartEmpty = cartItems.length === 0;

    return (
        <div>
            <div className="cart-container">
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
                <button onClick={placeOrder} disabled={hasInsufficientPoints || orderStatus === 'Order Placed' || isCartEmpty} className="place-order-btn">Place Order</button>
                {orderStatus && <p style={{ color: orderStatus === 'Order Placed' ? 'green' : 'red' }}>{orderStatus}</p>}
                {hasInsufficientPoints && <p style={{ color: 'red' }}>Insufficient Points</p>}
                {cartItems.map((item) => {
                    const itemPrice = item.itemId.pointsRequired - item.itemId.discount;
                    return (
                        <div key={item._id} className="cart-item-card">
                            <img src={process.env.REACT_APP_API_URL + `/${item.itemId.images[0]}`} alt={item.itemId.name} className="cart-item-image" />
                            <div className="cart-item-details">
                                <h3 className="cart-item-name">{item.itemId.name}</h3>
                                <p className="cart-item-points">{formatNumber(itemPrice)} Points</p>
                            </div>
                            <div className="cart-item-actions">
                                <div className="cart-item-quantity">
                                    <button onClick={() => handleQuantityChange(item.itemId._id, item.quantity - 1)}>-</button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => handleQuantityChange(item.itemId._id, item.quantity + 1)}>+</button>
                                </div>
                                <p className="cart-item-total">{formatNumber(itemPrice * item.quantity)} Points</p>
                                <button className="cart-item-delete" onClick={() => handleRemoveItem(item.itemId._id)}>Delete</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Cart;
