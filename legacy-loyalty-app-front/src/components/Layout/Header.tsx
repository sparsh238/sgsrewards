import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUserCircle } from 'react-icons/fa';
import LogoImg from '../../assets/images/LogoSGS1.png';
import './Header.css';
import { formatNumber } from '../../utils/formatNumber';
import { breakStringOnCaps } from '../../utils/breakString';

const Header: React.FC = () => {
    const [username, setUsername] = useState<string | null>(null);
    const [availablePoints, setAvailablePoints] = useState<number | null>(null);
    const [userType, setUserType] = useState<string | null>(null);
    const [partyName, setPartyName] = useState<string | null>(null);
    const [tier, setTier] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        const storedUserType = localStorage.getItem('userType');
        const storedPartyname = localStorage.getItem('partyName');
        setUsername(storedUsername);
        setUserType(storedUserType);
        setPartyName(storedPartyname);

        const fetchUserDetails = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/user/profile`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    setAvailablePoints(data.availablePoints);
                    setTier(data.tier); // Set tier from the user profile
                } else {
                    console.error('Failed to fetch user profile:', data.message);
                }
            } catch (error) {
                console.error('Error fetching user details:', error);
            }
        };

        if (storedUsername && storedUserType === 'customer') {
            fetchUserDetails();
        }
    }, [location]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userType');
        localStorage.removeItem('partyName');
        window.location.href = '/';
    };

    const toggleDropdown = () => {
        setDropdownOpen(!dropdownOpen);
    };

    const navigateTo = (path: string) => {
        navigate(path);
    };

    const handleLogoClick = () => {
        const token = localStorage.getItem('token');
        if (token) {
            // Redirect to the appropriate route based on userType
            switch (userType) {
                case 'admin':
                    navigate('/admin-dashboard');
                    break;
                case 'superadmin':
                    navigate('/superadmin-dashboard');
                    break;
                case 'customer':
                    navigate('/user/shop');
                    break;
                default:
                    console.error('Unknown user type');
                    break;
            }
        }
    };

    const getTierStyle = () => {
        switch (tier) {
            case 'NoTier':
                return { backgroundColor: '#145C49', color: 'lightcoral', border: '2px solid lightcoral' };
            case 'Basic':
                return { backgroundColor: '#145C49', color: '#ffdd8f', border: '2px solid #ffdd8f' };
            case 'Bronze':
                return { backgroundColor: '#145C49', color: '#CD7F32', border: '2px solid #CD7F32' };
            case 'Silver':
                return { backgroundColor: '#145C49', color: '#A5A9B4', border: '2px solid #A5A9B4' };
            case 'Gold':
                return { backgroundColor: '#145C49', color: '#EFBF04', border: '2px solid #EFBF04' };
            case 'Platinum':
                return { backgroundColor: '#145C49', color: '#e1e8ee', border: '2px solid #e1e8ee' };
            default:
                return {};
        }
    };

    return (
        <header className="header">
            <div className="header-left">
                <div className="header-logo" onClick={handleLogoClick}><img src={LogoImg} alt="SGS Rewards" style={{ height: '50px', maxWidth: '70px' }} /></div>
                {(userType === 'admin' || userType === 'superadmin') && (
                    <div className="header-nav">
                        {userType === 'admin' && (
                            <>
                                <button 
                                    className={location.pathname === '/admin-dashboard' ? 'active' : ''} 
                                    onClick={() => navigateTo('/admin-dashboard')}
                                >
                                    Users
                                </button>
                                <button 
                                    className={location.pathname === '/admin-orders' ? 'active' : ''} 
                                    onClick={() => navigateTo('/admin-orders')}
                                >
                                    Orders
                                </button>
                                <button 
                                    className={location.pathname === '/admin-items' ? 'active' : ''} 
                                    onClick={() => navigateTo('/admin-items')}
                                >
                                    Items
                                </button>
                                <button 
                                    className={location.pathname === '/admin-bills' ? 'active' : ''} 
                                    onClick={() => navigateTo('/admin-bills')}
                                >
                                    Bills
                                </button>
                            </>
                        )}
                        {userType === 'superadmin' && (
                            <>
                                <button 
                                    className={location.pathname === '/superadmin-dashboard' ? 'active' : ''} 
                                    onClick={() => navigateTo('/superadmin-dashboard')}
                                >
                                    Users
                                </button>
                                <button 
                                    className={location.pathname === '/superadmin-orders' ? 'active' : ''} 
                                    onClick={() => navigateTo('/superadmin-orders')}
                                >
                                    Orders
                                </button>
                                <button 
                                    className={location.pathname === '/superadmin-items' ? 'active' : ''} 
                                    onClick={() => navigateTo('/superadmin-items')}
                                >
                                    Items
                                </button>
                                <button 
                                    className={location.pathname === '/superadmin-bills' ? 'active' : ''} 
                                    onClick={() => navigateTo('/superadmin-bills')}
                                >
                                    Bills
                                </button>
                                <button 
                                    className={location.pathname === '/superadmin-system' ? 'active' : ''} 
                                    onClick={() => navigateTo('/superadmin-system')}
                                >
                                    System
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            <div className="header-right">
                {username && (
                    <>
                        {tier && userType === 'customer' && (
                            <div className="header-tier" style={getTierStyle()} onClick={() => navigateTo('/tier-page')}>
                                <div className="tier-value">{breakStringOnCaps(tier)}</div>
                            </div>
                        )}
                        {availablePoints !== null && (
                            <div className="header-points">
                                <div>Your Points</div>
                                <div className='your-points'>{formatNumber(availablePoints)}</div>
                            </div>
                        )}
                        <div className="user-icon" onClick={toggleDropdown}>
                            <FaUserCircle size={40} color='#ffdd8f' />
                            {dropdownOpen && (
                                <div className="dropdown">
                                    <div className="dropdown-item username">{partyName}</div>
                                    <div className="dropdown-item" onClick={() => navigateTo('/help')}>Help</div>
                                    <div className="dropdown-item" onClick={handleLogout}>Logout</div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </header>
    );
};

export default Header;
