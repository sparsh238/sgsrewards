import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');

        if (token) {
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
    }, [navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCredentials(prevCreds => ({
            ...prevCreds,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            });
            const data = await response.json();
            if (!response.ok) {
                // Backend error responses use either `message` or `error`.
                throw new Error(data.message || data.error || 'Failed to login');
            }
            login(data.refreshToken, data.user.username, data.user.userType, data.user.partyName);

            // Check if the user needs to reset their password
            if (!data.user.isPasswordReset) {
                navigate('/reset-password');
                return;
            }

            // Redirect to appropriate route based on user type
            switch (data.user.userType) {
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
                    throw new Error('Unknown user type');
            }
        } catch (error) {
            setError((error as Error).message);
        }
    };

    return (
        <div className="login-box">
            <h2>Login To Earn Rewards!</h2>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={credentials.username}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                />
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default Login;
