import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaShoppingCart, FaUser } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './Footer.css';

const Footer: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { auth } = useAuth();

    return (
        <footer className="footer">
            {auth.userType === 'customer' ? (
                <>
                    <div 
                        className={`footer-item ${location.pathname === '/user/shop' ? 'active' : ''}`} 
                        onClick={() => navigate('/user/shop')}
                    >
                        <FaHome size={24} />
                        <span>Home</span>
                    </div>
                    <div 
                        className={`footer-item ${location.pathname === '/user/cart' ? 'active' : ''}`} 
                        onClick={() => navigate('/user/cart')}
                    >
                        <FaShoppingCart size={24} />
                        <span>Cart</span>
                    </div>
                    <div 
                        className={`footer-item ${location.pathname === '/user/profile' ? 'active' : ''}`} 
                        onClick={() => navigate('/user/profile')}
                    >
                        <FaUser size={24} />
                        <span>Profile</span>
                    </div>
                </>
            ) : (
                <div className="footer-info">
                    <p>SGS Rewards</p>
                    <p>For any queries contact: +91-8875765648 +91-9828398047 +91-9887353375</p>
                </div>
            )}
        </footer>
    );
};

export default Footer;
