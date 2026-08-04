import React, { useEffect, useState } from 'react';
import fetchUserPoints from '../../utils/fetchUserPoints';
import { formatNumber } from '../../utils/formatNumber';
import './ProfilePage.css';

interface Order {
    _id: string;
    orderIdAlias: string;
    items: Array<{ itemId: { name: string }; quantity: number }>;
    totalValue: number;
    orderDate: string;
    status: string;
}

interface Bill {
    _id: string;
    billNumber: string;
    billDate: string;
    billAmount: number;
}

const ProfilePage: React.FC = () => {
    const [username, setUsername] = useState<string | null>(null);
    const [partyName, setPartyName] = useState<string | null>(null);
    const [availablePoints, setAvailablePoints] = useState<number | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [activeSection, setActiveSection] = useState<string | null>(null);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        const storedPartyname = localStorage.getItem('partyName');
        setUsername(storedUsername);
        setPartyName(storedPartyname);
        fetchUserPointsFromUtils();
        fetchUserOrders();
        fetchUserBills();
    }, []);

    const fetchUserPointsFromUtils = async () => {
        try {
            const points = await fetchUserPoints();
            setAvailablePoints(points.availablePoints);
        } catch (error) {
            console.error('Failed to load points:', error);
        }
    };

    const fetchUserOrders = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                const sortedOrders = data.sort((a: Order, b: Order) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                setOrders(sortedOrders);
            } else {
                console.error('Failed to fetch orders:', data.message);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const fetchUserBills = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/bill/user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                const sortedBills = data.sort((a: Bill, b: Bill) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());
                setBills(sortedBills);
            } else {
                console.error('Failed to fetch bills:', data.message);
            }
        } catch (error) {
            console.error('Error fetching bills:', error);
        }
    };

    const renderOrderItems = (items: Array<{ itemId: { name: string }; quantity: number }>) => {
        return items.map((item, index) => (
            <div key={index} className="order-item">
                {item.itemId.name} x {item.quantity}
            </div>
        ));
    };

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    return (
        <div className="profile-page">
            <div className="profile-header">
                <div className="profile-info">
                    <h2>Hi, {partyName}</h2>
                    <p>Your username: <strong>{username}</strong></p>
                    <p>Your Points: <strong>{availablePoints !== null ? formatNumber(availablePoints) : 0}</strong></p>
                </div>
            </div>
            <div className="orders-section">
                <h3>Your Orders</h3>
                <div className="orders-container">
                    <div className={`orders-status ${activeSection === 'Pending' ? 'active' : ''}`}>
                        <h4 onClick={() => toggleSection('Pending')}>
                            Pending <span className="accordion-arrow">&#9660;</span>
                        </h4>
                        {activeSection === 'Pending' && orders.filter(order => order.status === 'Pending').map(order => (
                            <div key={order._id} className="order-card">
                                <div className="order-header">
                                    <span className="order-id">{order.orderIdAlias}</span>
                                    <span className="order-date">{new Date(order.orderDate).toLocaleDateString()}</span>
                                </div>
                                <div className="order-items">
                                    {renderOrderItems(order.items)}
                                </div>
                                <div className="order-total">
                                    Total: {formatNumber(order.totalValue)} Points
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className={`orders-status ${activeSection === 'Completed' ? 'active' : ''}`}>
                        <h4 onClick={() => toggleSection('Completed')}>
                            Completed <span className="accordion-arrow">&#9660;</span>
                        </h4>
                        {activeSection === 'Completed' && orders.filter(order => order.status === 'Completed').map(order => (
                            <div key={order._id} className="order-card">
                                <div className="order-header">
                                    <span className="order-id">{order.orderIdAlias}</span>
                                    <span className="order-date">{new Date(order.orderDate).toLocaleDateString()}</span>
                                </div>
                                <div className="order-items">
                                    {renderOrderItems(order.items)}
                                </div>
                                <div className="order-total">
                                    Total: {formatNumber(order.totalValue)} Points
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className={`orders-status ${activeSection === 'Cancelled' ? 'active' : ''}`}>
                        <h4 onClick={() => toggleSection('Cancelled')}>
                            Cancelled <span className="accordion-arrow">&#9660;</span>
                        </h4>
                        {activeSection === 'Cancelled' && orders.filter(order => order.status === 'Cancelled').map(order => (
                            <div key={order._id} className="order-card">
                                <div className="order-header">
                                    <span className="order-id">{order.orderIdAlias}</span>
                                    <span className="order-date">{new Date(order.orderDate).toLocaleDateString()}</span>
                                </div>
                                <div className="order-items">
                                    {renderOrderItems(order.items)}
                                </div>
                                <div className="order-total">
                                    Total: {formatNumber(order.totalValue)} Points
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="bills-section">
                <h3>Your Billing History</h3>
                <div className="bills-container">
                    {bills.map(bill => (
                        <div key={bill._id} className="bill-card">
                            <div className="bill-header">
                                <span className="bill-number">{bill.billNumber}</span>
                                <span className="bill-date">{new Date(bill.billDate).toLocaleDateString()}</span>
                            </div>
                            <div className="bill-total">
                                Amount: ₹{formatNumber(bill.billAmount)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
