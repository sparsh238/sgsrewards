import React, { useState } from 'react';
import { Item } from '../../interfaces/ItemsInterface';
import './ItemModal.css';

interface ItemModalProps {
    item: Item | null;
    onClose: () => void;
    onSave: (item: Item, imageFile: File | null) => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, onClose, onSave }) => {
    const [itemData, setItemData] = useState<Item>({
        _id: item?._id || '',
        name: item?.name || '',
        description: item?.description || '',
        pointsRequired: item?.pointsRequired || 0,
        discount: item?.discount || 0,
        stock: item?.stock || 0,
        image: item?.image || ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setItemData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSave(itemData, imageFile);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{item ? 'Edit Item' : 'Add New Item'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={itemData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="description">Description:</label>
                        <textarea
                            id="description"
                            name="description"
                            value={itemData.description}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="pointsRequired">Points Required:</label>
                        <input
                            type="number"
                            id="pointsRequired"
                            name="pointsRequired"
                            value={itemData.pointsRequired}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="discount">Discount:</label>
                        <input
                            type="number"
                            id="discount"
                            name="discount"
                            value={itemData.discount}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="stock">Stock:</label>
                        <input
                            type="number"
                            id="stock"
                            name="stock"
                            value={itemData.stock}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="image">Image:</label>
                        <input
                            type="file"
                            id="image"
                            name="image"
                            onChange={handleImageChange}
                            accept="image/*"
                        />
                    </div>
                    <button type="submit" className="item-modal-button">Save</button>
                    <button type="button" className="item-modal-button" onClick={onClose}>Cancel</button>
                </form>
            </div>
        </div>
    );
};

export default ItemModal;
