import React, { useState, useEffect } from 'react';
import AddUserModal from './AddUserModal';
import ConfirmModal from './ConfirmModal';
import ResetPasswordModal from './ResetPasswordModal';
import './SuperAdminDashboard.css';
import AddBillModal from '../Admin/AddBillModal';

interface User {
    _id: string;
    username: string;
    partyName: string;
    phoneNumber: string;
    availablePoints:number;
    totalPoints: number;
    blocked: boolean;
    userType: string;
    tier: string;
}

const tiers = ['NoTier', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'];

const SuperAdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [action, setAction] = useState<'delete' | 'block' | 'reset-password'>('delete');
    const [selectedUserBlockedStatus, setSelectedUserBlockedStatus] = useState(false); // Added state for blocked status
    const [selectedUserTier, setSelectedUserTier] = useState<string>('');
    const [selectedUserName, setSelectedUserName] = useState<string>('');

    useEffect(() => {
        const fetchUsers = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found');
                return;
            }

            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/superadmin/allusers', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data);
                } else {
                    console.error('Failed to fetch users');
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        fetchUsers();
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.partyName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddBillClick = (userId: string, tier: string, name:string) => {
        setSelectedUserId(userId);
        setSelectedUserTier(tier);
        setSelectedUserName(name);
        setIsBillModalOpen(true);
    };

    const handleBillModalClose = () => {
        setIsBillModalOpen(false);
    };

    const handleSaveBill = async (billNumber: string, billDate: string | null, billAmount: number) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

	const formattedBillDate = billDate ? billDate : new Date().toISOString().split('T')[0];

        const requestBody = {
            userId: selectedUserId,
            billNumber,
            billDate: formattedBillDate,
            billAmount
        };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/bill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                console.log('Bill added successfully');
                setIsBillModalOpen(false);
		window.location.reload();
            } else {
                console.error('Failed to add bill');
            }
        } catch (error) {
            console.error('Error adding bill:', error);
        }
    };

    const handleAddUserClick = () => {
        setIsAddUserModalOpen(true);
    };

    const handleCloseAddUserModal = () => {
        setIsAddUserModalOpen(false);
    };

    const handleSaveUser = async (username: string, partyName: string, phoneNumber: string, password: string, userType: string) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const requestBody = { username, partyName, phoneNumber, password, userType };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/superadmin/sausers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                console.log('User added successfully');
                setIsAddUserModalOpen(false);
                // Refresh users list
                const data = await response.json();
                setUsers([...users, data]);
            } else {
                console.error('Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
        }
    };

    const handleActionClick = (userId: string, action: 'delete' | 'block' | 'reset-password', blockedStatus?: boolean) => {
        setSelectedUserId(userId);
        setAction(action);
        if (action === 'reset-password') {
            setIsResetPasswordModalOpen(true);
        } else if (action === 'block') {
            setSelectedUserBlockedStatus(blockedStatus ?? false); // Set the blocked status
            setIsConfirmModalOpen(true);
        } else {
            setIsConfirmModalOpen(true);
        }
    };

    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
    };

    const handleCloseResetPasswordModal = () => {
        setIsResetPasswordModalOpen(false);
    };

    const handleDeleteUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + `/api/superadmin/users/${selectedUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log('User deleted successfully');
                setIsConfirmModalOpen(false);
                // Remove user from list
                setUsers(users.filter(user => user._id !== selectedUserId));
            } else {
                console.error('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleBlockUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const requestBody = { blocked: !selectedUserBlockedStatus }; // Toggle blocked status

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + `/api/superadmin/users/${selectedUserId}/block`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                console.log('User block status updated successfully');
                setIsConfirmModalOpen(false);
                // Update user block status in list
                setUsers(users.map(user =>
                    user._id === selectedUserId ? { ...user, blocked: !selectedUserBlockedStatus } : user
                ));
            } else {
                console.error('Failed to update user block status');
            }
        } catch (error) {
            console.error('Error updating user block status:', error);
        }
    };

    const handleResetPassword = async (newPassword: string) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const requestBody = { newPassword };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + `/api/superadmin/users/${selectedUserId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                console.log('Password reset successfully');
                setIsResetPasswordModalOpen(false);
            } else {
                console.error('Failed to reset password');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
        }
    };

    const handleTierChange = async (userId: string, newTier: string) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const requestBody = { userId, newTier };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/superadmin/users/change-tier', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                console.log(`User tier updated to ${newTier}`);
                setUsers((prevUsers) =>
                    prevUsers.map((user) =>
                        user._id === userId ? { ...user, tier: newTier } : user
                    )
                );
            } else {
                console.error('Failed to update user tier');
            }
        } catch (error) {
            console.error('Error updating user tier:', error);
        }
    };

    return (
        <div className="superadmin-dashboard">
            <h1>User List</h1>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by username"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
                <button className='add-user-button' onClick={handleAddUserClick}>Add User</button>
            </div>
            <div className="user-lists">
                {['customer', 'admin', 'superadmin'].map(userType => (
                    <div key={userType} className="user-list">
                        <h2>{userType.charAt(0).toUpperCase() + userType.slice(1)}s</h2>
                        <table className="user-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Party Name</th>
                                    <th>Phone Number</th>
                                    <th>Current Points</th>
                                    <th>Total Points</th>
                                    <th>Tier</th>
                                    <th>Blocked</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers
                                    .filter(user => user.userType === userType)
                                    .map(user => (
                                        <tr key={user._id}>
                                            <td>{user.username}</td>
                                            <td>{user.partyName}</td>
                                            <td>{user.phoneNumber}</td>
                                            <td>{user.availablePoints}</td>
                                            <td>{user.totalPoints}</td>
                                            <td>
                                                <select
                                                    value={user.tier}
                                                    onChange={(e) =>
                                                        handleTierChange(user._id, e.target.value)
                                                    }
                                                >
                                                    {tiers.map((tier) => (
                                                        <option key={tier} value={tier}>
                                                            {tier}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={user.blocked}
                                                    onChange={() => handleActionClick(user._id, 'block', user.blocked)} // Pass the current blocked status
                                                />
                                            </td>
                                            <td>
                                                <button className='sa-user-action-button' onClick={() => handleAddBillClick(user._id, user.tier, user.username)}>Add Bill</button>
                                                <button className='sa-user-action-button' onClick={() => handleActionClick(user._id, 'reset-password')}>Reset Password</button>
                                                <button className='sa-user-action-button' onClick={() => handleActionClick(user._id, 'delete')}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
            <AddBillModal
                isOpen={isBillModalOpen}
                onClose={handleBillModalClose}
                onSave={handleSaveBill}
                userId={selectedUserId}
                tier={selectedUserTier}
                username={selectedUserName}
            />
            <AddUserModal
                isOpen={isAddUserModalOpen}
                onClose={handleCloseAddUserModal}
                onSave={handleSaveUser}
            />
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={action === 'delete' ? handleDeleteUser : handleBlockUser} // Use handleBlockUser directly
                action={action}
            />
            <ResetPasswordModal
                isOpen={isResetPasswordModalOpen}
                onClose={handleCloseResetPasswordModal}
                onSave={handleResetPassword}
            />
        </div>
    );
};

export default SuperAdminDashboard;
