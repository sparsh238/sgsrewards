import React, { useState, useEffect } from 'react';
import { Order } from '../../interfaces/OrderInterface';
import './AdminOrdersDashboard.css';

const AdminOrdersDashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [newStatus, setNewStatus] = useState<'Pending' | 'Completed' | 'Cancelled'>('Pending');
    const [activeSection, setActiveSection] = useState<string | null>('Pending');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/admin/orders', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();

                // Sort the orders by orderDate in descending order (latest first)
                const sortedOrders = data.sort((a: Order, b: Order) => {
                    return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
                });

                setOrders(sortedOrders);
            } catch (error) {
                console.error('Error fetching orders:', error);
            }
        };

        fetchOrders();
    }, []);

    const handleEditClick = (orderId: string, currentStatus: 'Pending' | 'Completed' | 'Cancelled') => {
        setEditingOrderId(orderId);
        setNewStatus(currentStatus);
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setNewStatus(e.target.value as 'Pending' | 'Completed' | 'Cancelled');
    };

    const handleUpdateClick = async (orderId: string) => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + `/api/admin/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (response.ok) {
                setOrders(prevOrders =>
                    prevOrders.map(order =>
                        order._id === orderId ? { ...order, status: newStatus } : order
                    )
                );
                setEditingOrderId(null);
                setNewStatus('Pending');
            } else {
                console.error('Error updating order status');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    };

    const handleAccordionToggle = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const filteredOrders = orders.filter(order =>
        order.orderIdAlias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.userId.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderOrders = (status: 'Pending' | 'Completed' | 'Cancelled') => {
        return filteredOrders.filter(order => order.status === status).map(order => (
            <div key={order._id} className="admin-order-entry">
                <div className="admin-order-header">
                    <p className="admin-order-id">Order ID: {order.orderIdAlias}</p>
                    <p className="admin-order-date">{new Date(order.orderDate).toLocaleDateString()}</p>
                </div>
                <div className="admin-order-details">
                    <p> <span>{order.userId.username}</span></p>
                    <div className="admin-order-items">
                        <h4>Ordered Items</h4>
                        <ul>
                            {order.items.map(item => (
                                <li key={item.itemId._id}>
                                    <span>{item.itemId.name} x {item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="admin-order-address">
                        <p><span>Address:</span> 
                        <span>
                            {order.address ? 
                                `${order.address.addressLine1}, ${order.address.addressLine2 ? order.address.addressLine2 + ', ' : ''}${order.address.city}, ${order.address.state}, ${order.address.country}, ${order.address.pinCode}`
                                : 'No address provided'}
                        </span></p>
                    </div>
                    <div className="admin-order-total">
                        <p>Total: {order.totalValue} Points</p>
                    </div>
                </div>
                {editingOrderId === order._id ? (
                    <div>
                        <select value={newStatus} onChange={handleStatusChange}>
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                        <button onClick={() => handleUpdateClick(order._id)}>Update</button>
                    </div>
                ) : (
                    status !== 'Cancelled' && <button onClick={() => handleEditClick(order._id, order.status)}>Edit Status</button>
                )}
            </div>
        ));
    };

    useEffect(() => {
        if (searchTerm) {
            setActiveSection(null); // Expand all sections if there's a search term
        }
    }, [searchTerm]);

    return (
        <div className="admin-orders-dashboard">
            <h1 className='admin-heading-order'>Orders</h1>
            <div className="admin-search-container">
                <input
                    type="text"
                    placeholder="Search by order ID or username"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </div>
            <div className="admin-orders-section">
                <h2 onClick={() => handleAccordionToggle('Pending')}>
                    Pending Orders <span className="admin-accordion-arrow">&#9660;</span>
                </h2>
                {(activeSection === 'Pending' || searchTerm) && renderOrders('Pending')}
            </div>
            <div className="admin-orders-section">
                <h2 onClick={() => handleAccordionToggle('Completed')}>
                    Completed Orders <span className="admin-accordion-arrow">&#9660;</span>
                </h2>
                {(activeSection === 'Completed' || searchTerm) && renderOrders('Completed')}
            </div>
            <div className="admin-orders-section">
                <h2 onClick={() => handleAccordionToggle('Cancelled')}>
                    Cancelled Orders <span className="admin-accordion-arrow">&#9660;</span>
                </h2>
                {(activeSection === 'Cancelled' || searchTerm) && renderOrders('Cancelled')}
            </div>
        </div>
    );
};

export default AdminOrdersDashboard;
