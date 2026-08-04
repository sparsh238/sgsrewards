import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {parseFormattedNumber} from '../../utils/formatNumber'
import { FaCheck } from 'react-icons/fa6';

interface ItemCardProps {
    _id: string;
    name: string;
    image: string;
    description: string;
    pointsRequired: string;
    discount: number;
    discountPercentage: string;
    pointsAfterDiscount: string;
    billingAmount: string;
}

const ItemCard: React.FC<ItemCardProps> = ({
    _id,
    name,
    image,
    pointsRequired,
    discount,
    discountPercentage,
    pointsAfterDiscount,
    billingAmount
}) => {
    const [showPopup, setShowPopup] = useState(false);
    const navigate = useNavigate();

    const handleAddToCart = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ itemId: _id, quantity: 1 })
            });

            if (!response.ok) {
                throw new Error('Failed to add item to cart');
            }

            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2000);
            console.log('Item added to cart successfully');
        } catch (error) {
            console.error('Error adding item to cart:', error);
        }
    };

    const handleCardClick = () => {
        navigate(`/product/${_id}`);
    };

    const handleBuyNow = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate('/buy-now', { state: { item: { _id, name, image, pointsRequired: String(pointsRequired), discount: Number(discount) } } });
    };

    return (
        <div className="item-card" onClick={handleCardClick}>
            <img src={process.env.REACT_APP_API_URL + `/${image}`} alt={name} className="item-image" width='300px' height="300px" />
            <div className="item-details">
                <h3 className="item-name">{name}</h3>
                {discount > 0 ? (
                    <>
                        <p className="item-points">
                           <span className='final-price'>{pointsAfterDiscount} points</span>
                        </p>
                        <p> <s>{pointsRequired} points</s> <span className='discount-percent'>({discountPercentage}% off)</span> 
                        </p> 
                    </>
                ) : (
                    <p className="item-points final-price">{pointsRequired} points</p>
                )}
                {parseFormattedNumber(billingAmount) > 0 ? (
                    <>
                        <p className="item-billing">₹{billingAmount} more billing required</p>
                    </>
                ) : (
                    <p className="item-billing"><FaCheck size={15} color='green'/> You can buy this item</p>
                )}
                {/* <p className="item-billing">Rs. {billingAmount} more billing required</p> */}
            </div>
            <div className="item-actions">
                <button onClick={handleAddToCart} className="item-button">Add to Cart</button>
                <button onClick={handleBuyNow} className="item-button">Buy Now</button>
            </div>
            {showPopup && <div className="popup">"{name}" has been added to your cart</div>}
        </div>
    );
};

export default ItemCard;
