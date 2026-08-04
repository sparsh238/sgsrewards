import React, { useState, useEffect } from 'react';
import './AddUserModal.css';

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (username: string, partyName : string, phoneNumber: string, password: string, userType: string) => void;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSave }) => {
    const [username, setUsername] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [partyName, setPartyName] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('customer');

    useEffect(() => {
        if (!isOpen) {
            setUsername('');
            setPartyName('');
            setPhoneNumber('');
            setPassword('');
            setUserType('customer');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSave(username, partyName, phoneNumber, password, userType);
    };

    return isOpen ? (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Add User</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username:</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="partyNane">Party Name:</label>
                        <input
                            type="text"
                            id="partyName"
                            value={partyName}
                            onChange={(e) => setPartyName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phoneNumber">Phone Number:</label>
                        <input
                            type="text"
                            id="phoneNumber"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="userType">User Type:</label>
                        <select
                            id="userType"
                            value={userType}
                            onChange={(e) => setUserType(e.target.value)}
                            required
                        >
                            <option value="customer">Customer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button className='sa-add-user' type="submit">Save</button>
                    <button className='sa-add-user' type="button" onClick={onClose}>Cancel</button>
                </form>
            </div>
        </div>
    ) : null;
};

export default AddUserModal;
