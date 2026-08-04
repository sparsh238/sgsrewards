import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ThankYou.css';
import { FaTimes } from 'react-icons/fa';  // Import an icon from react-icons
import { formatNumber } from '../../utils/formatNumber';

const ThankYou: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const remainingPoints = location.state?.remainingPoints;

    return (
        <div className="thank-you-page">
            <div className="thank-you-header">
                <FaTimes className="close-icon" onClick={() => navigate('/user/shop')} />
            </div>
            <div className="thank-you-content">
                <h1>Thank You!</h1>
                <p>Your order has been placed successfully.</p>
                <p className="remaining-points">Remaining Points: <strong>{formatNumber(remainingPoints)}</strong></p>
                <button className="keep-shopping-button" onClick={() => navigate('/user/shop')}>Keep Shopping</button>
            </div>
        </div>
    );
};

export default ThankYou;
