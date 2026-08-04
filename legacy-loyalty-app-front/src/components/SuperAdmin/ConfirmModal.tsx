import React from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    action: 'delete' | 'block' | 'reset-password';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, action }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Confirm {action === 'delete' ? 'Deletion' : action === 'block' ? 'Block/Unblock' : 'Password Reset'}</h2>
                <p>Are you sure you want to {action === 'delete' ? 'delete' : action === 'block' ? 'block/unblock' : 'reset the password for'} this user?</p>
                <button className='sa-confirm-button' onClick={onConfirm}>Yes</button>
                <button className='sa-confirm-button' onClick={onClose}>No</button>
            </div>
        </div>
    );
};

export default ConfirmModal;
