import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatNumber } from '../../utils/formatNumber';
import { useNavigate } from 'react-router-dom';
import apiFetch from '../../utils/apiFetch';
import './ProductPage.css';

interface Item {
    _id: string;
    name: string;
    images: string[];
    description: string;
    pointsRequired: number;
    discount: number;
}

const ProductPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<Item | null>(null);
    const [conversionPoints, setConversionPoints] = useState<number>(0);
    const [showPopup, setShowPopup] = useState<boolean>(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchItemDetails = async () => {
            try {
                const response = await apiFetch(`/api/item/itm/${id}`);
                const data = await response.json();
                setItem(data);
            } catch (error) {
                console.error('Failed to fetch item details:', error);
            }
        };

        const fetchConversionPoints = async () => {
            try {
                const response = await apiFetch('/api/superadmin/system/points-conversion');
                const data = await response.json();
                setConversionPoints(data.pointsConversion);
            } catch (error) {
                console.error('Error fetching points conversion:', error);
            }
        };

        fetchItemDetails();
        fetchConversionPoints();
    }, [id]);

    if (!item) {
        return <div>Loading...</div>;
    }

    const discountPercentage = item.pointsRequired ? ((item.discount / item.pointsRequired) * 100).toFixed(2) : '0';
    const pointsAfterDiscount = item.pointsRequired ? item.pointsRequired - item.discount : 0;
    const billingAmount = pointsAfterDiscount * conversionPoints;

    const handleAddToCart = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await apiFetch('/api/user/cart/add', {
                method: 'POST',
                json: { itemId: item._id, quantity: 1 }
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

    const handleBuyNow = () => {
        // Pass the RAW pointsRequired and discount; BuyNow subtracts the discount
        // once. (Passing an already-discounted value here double-discounts.)
        navigate('/buy-now', { state: { item: { _id: item._id, name: item.name, image: item.images[0], pointsRequired: String(item.pointsRequired), discount: item.discount } } });
    };

    return (
        <div>
            <div className="product-container">
                <img src={process.env.REACT_APP_API_URL + `/${item.images[0]}`} alt={item.name} className="product-image" />
                <div className="product-details">
                    <h3 className="product-name">{item.name}</h3>
                    {item.discount > 0 ? (
                        <>
                            <p className="product-points">{formatNumber(pointsAfterDiscount)} points</p>
                            <p className="product-points-strike">
                                <s>{formatNumber(item.pointsRequired)} points</s> <span className='buy-now-discount'>({discountPercentage}% off)</span>
                            </p>
                        </>
                    ) : (
                        <p className="product-points">{formatNumber(item.pointsRequired)} points</p>
                    )}
                    <p className="product-billing">Billing required: ₹{formatNumber(billingAmount)}</p>
                    <div className="product-actions">
                        <button className="product-button add-to-cart-button" onClick={handleAddToCart}>
                            Add to Cart
                        </button>
                        <button className="product-button buy-now-button" onClick={handleBuyNow}>
                            Buy Now
                        </button>
                    </div>
                    {showPopup && <div className="popup">"{item.name}" has been added to your cart</div>}
                </div>
                <div className="product-description">
                    <h4>Description</h4>
                    {/* Rendered as plain text (whiteSpace preserves line breaks)
                        to avoid injecting admin-entered HTML/script into the page. */}
                    <p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
                </div>
            </div>
        </div>
    );
};

export default ProductPage;
