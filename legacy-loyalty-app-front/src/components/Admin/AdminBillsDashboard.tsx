import React, { useState, useEffect } from 'react';
import './AdminBillsDashboard.css';
import AddBillModal from './AddBillModal';

interface Bill {
    _id: string;
    userId: {
        username: string;
        tier?: string;
    };
    billNumber: string;
    billDate: string;
    billAmount: number;
}

const AdminBillsDashboard: React.FC = () => {
    const [bills, setBills] = useState<Bill[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

    useEffect(() => {
        const fetchBills = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/bill', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok) {
                    setBills(data);
                } else {
                    console.error('Failed to fetch bills:', data.message);
                }
            } catch (error) {
                console.error('Error fetching bills:', error);
            }
        };

        fetchBills();
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleEditBill = (bill: Bill) => {
        setSelectedBill(bill);
        setIsModalOpen(true);
    };

    const handleSaveBill = async (billNumber: string, billDate: string, billAmount: number) => {
        if (!selectedBill) return;

        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/bill/${selectedBill._id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ billNumber, billDate, billAmount }),
            });
            const data = await response.json();
            if (response.ok) {
                setBills((prevBills) =>
                    prevBills.map((bill) =>
                        bill._id === selectedBill._id
                            ? { ...bill, billNumber, billDate, billAmount }
                            : bill
                    )
                );
            } else {
                console.error('Error updating bill:', data.message);
            }
        } catch (error) {
            console.error('Error updating bill:', error);
        }

        setIsModalOpen(false); // Close the modal after saving
    };

    const handleDeleteBill = (billId: string) => {
        if (window.confirm('Are you sure you want to delete this bill?')) {
            const token = localStorage.getItem('token');
            fetch(`${process.env.REACT_APP_API_URL}/api/bill/${billId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
            .then(response => {
                if (response.ok) {
                    setBills((prevBills) => prevBills.filter((bill) => bill._id !== billId));
                } else {
                    console.error('Error deleting bill');
                }
            })
            .catch(error => console.error('Error deleting bill:', error));
        }
    };

    const filteredBills = bills.filter((bill) =>
        bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.userId.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="admin-bills-dashboard">
            <h1>Bills</h1>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by bill number or user name"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </div>
            <table className="bills-table">
                <thead>
                    <tr>
                        <th>Bill Number</th>
                        <th>Username</th>
                        <th>Bill Date</th>
                        <th>Bill Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredBills.map((bill) => (
                        <tr key={bill._id}>
                            <td>{bill.billNumber}</td>
                            <td>{bill.userId.username}</td>
                            <td>{new Date(bill.billDate).toLocaleDateString()}</td>
                            <td>{bill.billAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                            <td>
                                <button onClick={() => handleEditBill(bill)}>Edit</button>
                                <button onClick={() => handleDeleteBill(bill._id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* AddBillModal used for editing */}
            {isModalOpen && selectedBill && (
                <AddBillModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveBill}
                    userId={selectedBill.userId.username}
                    initialData={{
                        billNumber: selectedBill.billNumber,
                        billDate: selectedBill.billDate,
                        billAmount: selectedBill.billAmount
                    }} // Pass initial data for autofill
                    tier={selectedBill.userId.tier || ''}
                    username={selectedBill.userId.username}
                />
            )}
        </div>
    );
};

export default AdminBillsDashboard;
