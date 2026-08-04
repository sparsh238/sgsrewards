import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './AdminDashboard.css';
import AddBillModal from './AddBillModal';
import AddUserModal from './AddUserModal';

interface User {
    _id: string;
    username: string;
    partyName: string;
    phoneNumber: string;
    availablePoints: number;
    totalPoints: number;
    tier:string;
    blocked: boolean;
}

const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
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
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/admin/users', {
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

    const handleAddBillClick = (userId: string, tier: string, name: string) => {
        setSelectedUserId(userId);
        setSelectedUserTier(tier);
        setSelectedUserName(name);
        setIsBillModalOpen(true);
    };

    const handleBillModalClose = () => {
        setIsBillModalOpen(false);
    };

    const handleUserModalClose = () => {
        setIsUserModalOpen(false);
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

    const handleAddUser = async (user: { username: string; partyName: string, phoneNumber: string; password: string }) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const requestBody = {
            username: user.username,
            partyName: user.partyName,
            phoneNumber: user.phoneNumber,
            password: user.password
        };

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/api/admin/add-customer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const newUser = await response.json();
                setUsers([...users, newUser]);
                setIsUserModalOpen(false);
            } else {
                console.error('Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const usersData = json.slice(1).map((row: any) => ({
                username: row[0],
                partyName: row[1],
                phoneNumber: row[2],
                password: row[3]
            }));

            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found');
                return;
            }

            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/admin/add-customers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ users: usersData })
                });

                if (response.ok) {
                    const addedUsers = await response.json();
                    setUsers([...users, ...addedUsers]);
                    console.log('Users added successfully');
                } else {
                    console.error('Failed to add users');
                }
            } catch (error) {
                console.error('Error adding users:', error);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>User List</h1>
                <button className="add-user-button" onClick={() => setIsUserModalOpen(true)}>Add User</button>
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="upload-file-button" />
            </div>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by username"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </div>
            <table className="admin-user-table">
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
                    {filteredUsers.map(user => (
                        <tr key={user._id}>
                            <td>{user.username}</td>
                            <td>{user.partyName}</td>
                            <td>{user.phoneNumber}</td>
                            <td>{user.availablePoints}</td>
                            <td>{user.totalPoints}</td>
                            <td>{user.tier}</td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={user.blocked}
                                    readOnly
                                />
                            </td>
                            <td>
                                <button onClick={() => handleAddBillClick(user._id, user.tier, user.username)}>Add Bill</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <AddBillModal
                isOpen={isBillModalOpen}
                onClose={handleBillModalClose}
                onSave={handleSaveBill}
                userId={selectedUserId}
                tier={selectedUserTier}
                username={selectedUserName}
            />
            <AddUserModal
                isOpen={isUserModalOpen}
                onClose={handleUserModalClose}
                onSave={handleAddUser}
            />
        </div>
    );
};

export default AdminDashboard;
