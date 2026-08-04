import React, { useState, useEffect } from 'react';
import ItemCard from '../Layout/ItemCard';
import { formatNumber } from '../../utils/formatNumber';
import fetchUserPoints from '../../utils/fetchUserPoints';
import LogoImg from '../../assets/images/giftimg-rbg.png';

const Shop: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [tierConversionPoints, setTierConversionPoints] = useState<{ [key: string]: number }>({});
    const [userTier, setUserTier] = useState<string | null>(null);
    const [conversionPoints, setConversionPoints] = useState<number>(0);
    const [availablePoints, setAvailablePoints] = useState<number | null>(null);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/item');
                const data = await response.json();
                if (response.ok) {
                    setItems(data.filter((item: any) => item.stock > 0)); // Filter out items with zero stock
                } else {
                    console.error('Failed to fetch items:', data.message);
                }
            } catch (error) {
                console.error('Error fetching items:', error);
            }
        };

        const fetchTierConversionPoints = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/superadmin/system/points-conversion', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                if (data.tierPointsConversion) {
                    setTierConversionPoints(data.tierPointsConversion);
                }
            } catch (error) {
                console.error('Error fetching tier conversion points:', error);
            }
        };

        const fetchUserProfile = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                setUserTier(data.tier);
            } catch (error) {
                console.error('Error fetching user profile:', error);
            }
        };

        const fetchPoints = async () => {
            try {
                const points = await fetchUserPoints();
                setAvailablePoints(points.availablePoints);
            } catch (error) {
                console.error('Failed to load points:', error);
            }
        };

        const initializeShopData = async () => {
            await fetchItems();
            await fetchTierConversionPoints();
            await fetchUserProfile();
            await fetchPoints();
        };

        initializeShopData();
    }, []);

    useEffect(() => {
        // Set the conversion points based on the user's tier
        if (userTier && tierConversionPoints[userTier]) {
            setConversionPoints(tierConversionPoints[userTier]);
        }
    }, [userTier, tierConversionPoints]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="banner">
                <div className="banner-content">
                    <div className="banner-left">
                        <img src={LogoImg} alt="SGS Rewards" />
                    </div>
                    <div className="banner-right">
                        <h2>SGS Rewards</h2>
                        <p>Earn with every purchase</p>
                    </div>
                </div>
                <div className="banner-bottom">
                    {userTier === 'NoTier' ? (
                        <p>You are not earning points</p>
                    ) : (
                        <p>Earn 1 point for billing of every Rs. {conversionPoints}</p>
                    )}
                </div>
            </div>

            <div className="shop-container">
                <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-bar"
                />
                <div className="item-grid">
                    {filteredItems.map((item) => {
                        const discountPercentage = ((item.discount / item.pointsRequired) * 100).toFixed(2);
                        const pointsAfterDiscount = item.pointsRequired - item.discount;
                        const billingAmount = pointsAfterDiscount * conversionPoints;
                        let finalBillingAmount = 0;
                        if (availablePoints !== null) {
                            const billingLeft = billingAmount - (availablePoints * conversionPoints);
                            finalBillingAmount = billingLeft <= 0 ? 0 : billingLeft;
                        }
                        return (
                            <ItemCard
                                key={item._id}
                                _id={item._id}
                                name={item.name}
                                image={item.images[0]}
                                description=""
                                pointsRequired={formatNumber(item.pointsRequired)}
                                discount={item.discount}
                                discountPercentage={discountPercentage}
                                pointsAfterDiscount={formatNumber(pointsAfterDiscount)}
                                billingAmount={formatNumber(finalBillingAmount)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Shop;
