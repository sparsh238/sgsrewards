import React, { useState, useEffect } from 'react';
import './SuperAdminSystemDashboard.css';

interface TierPointsConversion {
    [tier: string]: number;
}

interface TierBillingRequirements {
    [tier: string]: number;
}

const SuperAdminSystemDashboard: React.FC = () => {
    const [pointsConversion, setPointsConversion] = useState<number | null>(null);
    const [tierPointsConversion, setTierPointsConversion] = useState<TierPointsConversion>({});
    const [tierBillingRequirements, setTierBillingRequirements] = useState<TierBillingRequirements>({});
    const [isEditing, setIsEditing] = useState(false);
    const [newPointsConversion, setNewPointsConversion] = useState<number>(0);
    const [newTierPointsConversion, setNewTierPointsConversion] = useState<TierPointsConversion>({});
    const [newTierBillingRequirements, setNewTierBillingRequirements] = useState<TierBillingRequirements>({});

    useEffect(() => {
        const fetchSystemSettings = async () => {
            const token = localStorage.getItem('token');
            try {
                // Fetch points conversion
                const pointsResponse = await fetch(
                    process.env.REACT_APP_API_URL + '/api/superadmin/system/points-conversion',
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const pointsData = await pointsResponse.json();
                setPointsConversion(pointsData.pointsConversion);
                setTierPointsConversion(pointsData.tierPointsConversion);
                setNewTierPointsConversion(pointsData.tierPointsConversion);

                // Fetch tier billing requirements
                const billingResponse = await fetch(
                    process.env.REACT_APP_API_URL + '/api/superadmin/system/tier-billing-requirements',
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const billingData = await billingResponse.json();
                setTierBillingRequirements(billingData.tierBillingRequirements);
                setNewTierBillingRequirements(billingData.tierBillingRequirements);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };

        fetchSystemSettings();
    }, []);

    const handleEditClick = () => {
        setNewPointsConversion(pointsConversion || 0);
        setIsEditing(true);
    };

    const handleSaveClick = async () => {
        const token = localStorage.getItem('token');
        try {
            // Update points conversion
            const pointsResponse = await fetch(
                process.env.REACT_APP_API_URL + '/api/superadmin/system/points-conversion',
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        pointsConversion: newPointsConversion,
                        tierPointsConversion: newTierPointsConversion,
                    }),
                }
            );

            // Update tier billing requirements
            const billingResponse = await fetch(
                process.env.REACT_APP_API_URL + '/api/superadmin/system/tier-billing-requirements',
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ tierBillingRequirements: newTierBillingRequirements }),
                }
            );

            if (pointsResponse.ok && billingResponse.ok) {
                setPointsConversion(newPointsConversion);
                setTierPointsConversion(newTierPointsConversion);
                setTierBillingRequirements(newTierBillingRequirements);
                setIsEditing(false);
            } else {
                console.error('Failed to update system settings');
            }
        } catch (error) {
            console.error('Error updating system settings:', error);
        }
    };

    const handleCancelClick = () => {
        setNewPointsConversion(pointsConversion || 0);
        setNewTierPointsConversion(tierPointsConversion);
        setNewTierBillingRequirements(tierBillingRequirements);
        setIsEditing(false);
    };

    const handleTierPointsChange = (tier: string, value: number) => {
        setNewTierPointsConversion((prev) => ({ ...prev, [tier]: value }));
    };

    const handleTierBillingChange = (tier: string, value: number) => {
        setNewTierBillingRequirements((prev) => ({ ...prev, [tier]: value }));
    };

    return (
        <div className="system-dashboard">
            <h1>System Settings</h1>
            <div className="points-conversion">
                <label>Points Conversion Value: </label>
                {isEditing ? (
                    <>
                        <input
                            type="number"
                            value={newPointsConversion}
                            onChange={(e) => setNewPointsConversion(Number(e.target.value))}
                        />
                    </>
                ) : (
                    <span>{pointsConversion}</span>
                )}
            </div>

            <div className="tier-settings">
                <h2>Tier Points Conversion</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tier</th>
                            <th>Points Conversion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(tierPointsConversion).map(([tier, value]) => (
                            <tr key={tier}>
                                <td>{tier}</td>
                                <td>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={newTierPointsConversion[tier] || 0}
                                            onChange={(e) =>
                                                handleTierPointsChange(tier, Number(e.target.value))
                                            }
                                        />
                                    ) : (
                                        value
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="tier-settings">
                <h2>Tier Billing Requirements</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tier</th>
                            <th>Billing Requirement</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(tierBillingRequirements).map(([tier, value]) => (
                            <tr key={tier}>
                                <td>{tier}</td>
                                <td>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={newTierBillingRequirements[tier] || 0}
                                            onChange={(e) =>
                                                handleTierBillingChange(tier, Number(e.target.value))
                                            }
                                        />
                                    ) : (
                                        `₹${value.toLocaleString('en-IN')}`
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="action-buttons">
                {isEditing ? (
                    <>
                        <button onClick={handleSaveClick}>Save</button>
                        <button onClick={handleCancelClick}>Cancel</button>
                    </>
                ) : (
                    <button onClick={handleEditClick}>Edit</button>
                )}
            </div>
        </div>
    );
};

export default SuperAdminSystemDashboard;
