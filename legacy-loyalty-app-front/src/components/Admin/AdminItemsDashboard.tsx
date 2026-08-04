import React, { useState, useEffect } from 'react';
import ItemModal from './ItemModal';
import { Item } from '../../interfaces/ItemsInterface';
import './AdminItemsDashboard.css';

const AdminItemsDashboard: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);

    useEffect(() => {
        const fetchItems = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(process.env.REACT_APP_API_URL + '/api/item', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                setItems(data);
            } catch (error) {
                console.error('Error fetching items:', error);
            }
        };

        fetchItems();
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEditItem = (item: Item) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        setSelectedItem(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
    };

    const handleDeleteItemClick = async (itemId: string) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        try {
            const response = await fetch(process.env.REACT_APP_API_URL + `/api/item/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setItems(items.filter(item => item._id !== itemId));
            } else {
                console.error('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleItemSave = async (item: Item, imageFile: File | null) => {
        const token = localStorage.getItem('token');
        const method = item._id ? 'PUT' : 'POST';
        const url = item._id
            ? process.env.REACT_APP_API_URL + `/api/item/${item._id}`
            : process.env.REACT_APP_API_URL + '/api/item';

        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('description', item.description);
        formData.append('pointsRequired', String(item.pointsRequired));
        formData.append('stock', String(item.stock));
        formData.append('discount', String(item.discount || 0));
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const updatedItem = await response.json();
                setItems(prevItems =>
                    item._id
                        ? prevItems.map(i => (i._id === item._id ? updatedItem : i))
                        : [...prevItems, updatedItem]
                );
                setIsModalOpen(false);
            } else {
                console.error('Error saving item');
            }
        } catch (error) {
            console.error('Error saving item:', error);
        }
    };

    return (
        <div className="admin-items-dashboard">
            <h1>Items</h1>
            <button className="add-item-button" onClick={handleAddItem}>Add New Item</button>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by item name"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </div>
            <table className="items-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Points Required</th>
                        <th>Discount</th>
                        <th>Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredItems.map(item => (
                        <tr key={item._id}>
                            <td>{item.name}</td>
                            <td>{item.description}</td>
                            <td>{item.pointsRequired}</td>
                            <td>{item.discount}</td>
                            <td>{item.stock}</td>
                            <td>
                                <button className='item-action-button' onClick={() => handleDeleteItemClick(item._id)}>Delete</button>
                                <button className='item-action-button' onClick={() => handleEditItem(item)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {isModalOpen && (
                <ItemModal
                    item={selectedItem}
                    onClose={handleModalClose}
                    onSave={handleItemSave}
                />
            )}
        </div>
    );
};

export default AdminItemsDashboard;
