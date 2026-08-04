import React, { useState, useEffect } from 'react';
import { Item } from '../../interfaces/ItemsInterface';
import fetchUserPoints from '../../utils/fetchUserPoints';
import './ItemDetails.css';
import TestImg from '../../assets/images/TestImg.jpg';

interface ItemDetailsProps {
    item: Item;
    selectedAddressId: string;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ item, selectedAddressId }) => {
    const [quantity, setQuantity] = useState(1);
    const [userPoints, setUserPoints] = useState({ availablePoints: 0, totalPoints: 0 });
    const [orderStatus, setOrderStatus] = useState('');

    useEffect(() => {
        const loadPoints = async () => {
            try {
                const points = await fetchUserPoints();
                setUserPoints(points);
            } catch (error) {
                console.error('Failed to load points:', error);
            }
        };

        loadPoints();
    }, []);

    const placeOrder = async () => {
        const token = localStorage.getItem('token');  // Get token directly here
        if (!token) {
            console.error('Authentication token not found');
            setOrderStatus('Authentication required');
            return;
        }

        const requestBody = {
            addressId: selectedAddressId,
            items: [{ itemId: item._id, quantity }]
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

            if (response.status === 201) {
                setOrderStatus('Order Placed');
            } else {
                setOrderStatus('Order Failed');
            }
        } catch (error) {
            console.error('Order placement failed:', error);
            setOrderStatus('Order Failed');
        }
    };

    const totalCost = item.pointsRequired * quantity;
    const remainingPoints = userPoints.availablePoints - totalCost;
    const hasInsufficientPoints = remainingPoints < 0;

    return (
        <div className="item-details">
            <img src={TestImg} alt={item.name} className="item-image" />
            <h2>{item.name}</h2>
            <p>{item.pointsRequired} points</p>
            <p>Stock: {item.stock}</p>
            <label>Quantity:
                <select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10))}>
                    {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}</option>)}
                </select>
            </label>
            <p>Total: {totalCost} points</p>
            <p>Available Points: {userPoints.availablePoints}</p>
            <p>Remaining Points: {remainingPoints}</p>
            {hasInsufficientPoints && <p style={{ color: 'red' }}>Insufficient Points</p>}
            <button onClick={placeOrder} disabled={hasInsufficientPoints || orderStatus === 'Order Placed'} className="place-order-btn">Place Order</button>
            {orderStatus && <p style={{ color: orderStatus === 'Order Placed' ? 'green' : 'red' }}>{orderStatus}</p>}
        </div>
    );
};

export default ItemDetails;
