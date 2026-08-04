import React, { useState, useEffect } from 'react';
import './AddBillModal.css';

interface AddBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (billNumber: string, billDate: string, billAmount: number) => void;
    userId: string;
    username: string;
    tier: string; // Pass the user's tier as a prop
    initialData?: { billNumber: string; billDate: string; billAmount: number }; // Optional initial data
}

const AddBillModal: React.FC<AddBillModalProps> = ({ isOpen, onClose, onSave, userId, tier, username, initialData }) => {
    const [billNumber, setBillNumber] = useState('');
    const [billDate, setBillDate] = useState('');
    const [billAmount, setBillAmount] = useState('');
    const [points, setPoints] = useState('');
    const [tierConversion, setTierConversion] = useState<number>(0);

    useEffect(() => {
        // Fetch the tier conversion points based on the tier
        const fetchTierConversion = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/superadmin/system/points-conversion', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                setTierConversion(data.tierPointsConversion[tier] || 1); // Default to 1 to avoid division by 0
            } catch (error) {
                console.error('Error fetching tier conversion:', error);
            }
        };

        fetchTierConversion();

        if (initialData) {
            setBillNumber(initialData.billNumber);
            setBillDate(initialData.billDate.slice(0, 10)); // Format the date
            setBillAmount(initialData.billAmount.toString());
            // Points preview is computed by the effect below once the tier
            // conversion has actually been fetched (computing it here used the
            // initial 0 and showed Infinity).
        }
    }, [initialData, tier]);

    // Recompute the points preview when the tier conversion arrives.
    // billAmount is deliberately NOT a dependency: it is kept in sync by the
    // input handlers, and reacting to it here would overwrite the points field
    // mid-typing.
    useEffect(() => {
        const amount = parseFloat(billAmount);
        if (tierConversion > 0 && !isNaN(amount)) {
            setPoints((amount / tierConversion).toFixed(2));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tierConversion]);

    const handleBillAmountChange = (value: string) => {
        setBillAmount(value);
        const amount = parseFloat(value);
        if (tierConversion > 0 && !isNaN(amount)) {
            setPoints((amount / tierConversion).toFixed(2));
        } else {
            setPoints('');
        }
    };

    const handlePointsChange = (value: string) => {
        setPoints(value);
        const points = parseFloat(value);
        if (tierConversion > 0 && !isNaN(points)) {
            setBillAmount((points * tierConversion).toFixed(2));
        } else {
            setBillAmount('');
        }
    };

    const handleSave = () => {
        onSave(billNumber, billDate, parseFloat(billAmount));
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Add Bill for User {username}</h2>
                <div className="form-group">
                    <label htmlFor="billNumber">Bill Number:</label>
                    <input
                        type="text"
                        id="billNumber"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="billDate">Bill Date:</label>
                    <input
                        type="date"
                        id="billDate"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="billAmount">Bill Amount:</label>
                    <input
                        type="number"
                        id="billAmount"
                        value={billAmount}
                        onChange={(e) => handleBillAmountChange(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="points">Points:</label>
                    <input
                        type="number"
                        id="points"
                        value={points}
                        onChange={(e) => handlePointsChange(e.target.value)}
                    />
                </div>
                <button className="add-bill-modal-button" onClick={handleSave}>
                    Save
                </button>
                <button className="add-bill-modal-button" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default AddBillModal;
