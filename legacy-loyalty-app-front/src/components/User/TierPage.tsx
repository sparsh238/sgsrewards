import React, { useEffect, useState } from 'react';
import './TierPage.css';
import { breakStringOnCaps } from '../../utils/breakString'
import starImg from '../../assets/images/star.svg'
import arrowDown from '../../assets/images/down-arrow.svg'

interface TierDetails {
    name: string;
    billingRequirement: number;
    conversionPoints: number;
    color: string;
}

const TierPage: React.FC = () => {
    const [tierDetails, setTierDetails] = useState<TierDetails[]>([]);
    const [currentTier, setCurrentTier] = useState<string | null>(null);
    const [currentQuarterBilling, setCurrentQuarterBilling] = useState<number>(0);
    const [nextQuarterTier, setNextQuarterTier] = useState<string | null>(null);
    const [nextTierMessage, setNextTierMessage] = useState<string | JSX.Element>('');
    const [loading, setLoading] = useState<boolean>(true);

    const fetchUserData = async () => {
        try {
            const userResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/user/profile`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const userData = await userResponse.json();
            setCurrentTier(userData.tier);
        } catch (error) {
            console.error('Error fetching user tier:', error);
        }
    };

    const getCurrentQuarter = () => {
        const today = new Date();
        const quarter = Math.floor(today.getMonth() / 3) + 1;
        const year = today.getFullYear();
        const startMonth = (quarter - 1) * 3;
        const endMonth = quarter * 3 - 1;
        return { year, startMonth, endMonth };
    };

    const determineNextQuarterTier = (currentTier: string, totalBilling: number) => {
        const tierOrder = tierDetails.map((tier) => tier.name);
        const currentTierIndex = tierOrder.indexOf(currentTier);

        if (currentTierIndex === -1) {
            return { nextTier: 'NoTier', billingLeft: null, message: '' };
        }

        // Check for downgrade
        let downgradedTier = currentTier;
        for (let i = currentTierIndex; i >= 0; i--) {
            const tier = tierDetails[i];
            if (totalBilling >= tier.billingRequirement) {
                downgradedTier = tier.name;
                break;
            }
        }
        if (downgradedTier === 'NoTier') {
            const billingLeftToStay = tierDetails[currentTierIndex].billingRequirement - totalBilling;
            const message = `you will not earn any points 
            Billing left to stay in ${currentTier}: ₹${billingLeftToStay.toLocaleString('en-IN')}`;
            return { nextTier: downgradedTier, billingLeft: billingLeftToStay, message };
        }

        if (tierOrder.indexOf(downgradedTier) < currentTierIndex) {
            const billingLeftToStay = tierDetails[currentTierIndex].billingRequirement - totalBilling;
            const message = (
                <>
                    Oh no! You will be demoted to <strong>{downgradedTier}</strong>.
                    Billing left to stay in <strong>{currentTier}</strong>: 
                    <span className="highlight"> ₹{billingLeftToStay.toLocaleString('en-IN')}</span>
                </>
            );
            return { nextTier: downgradedTier, billingLeft: billingLeftToStay, message };
        }

        

        // Check for upgrade or maintain
        let upgradedTier = currentTier;
        let billingLeftToUpgrade = null;
        for (let i = currentTierIndex + 1; i < tierDetails.length; i++) {
            const higherTier = tierDetails[i];
            if (totalBilling >= higherTier.billingRequirement) {
                upgradedTier = higherTier.name;
            } else {
                billingLeftToUpgrade = higherTier.billingRequirement - totalBilling;
                const message = `You're doing amazing! Keep going to reach ${higherTier.name} next quarter!`;
                return { nextTier: upgradedTier, billingLeft: billingLeftToUpgrade, message };
            }
        }

        if (upgradedTier === 'Platinum') {
            const message = `Wow, you're unstoppable! You'll stay in the Platinum tier next quarter!`;
            return { nextTier: 'Platinum', billingLeft: null, message };
        }

        const message = `You're right on track! Maintain this pace to stay in ${currentTier}!`;
        return { nextTier: upgradedTier, billingLeft: billingLeftToUpgrade, message };
    };

    const fetchTierData = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/superadmin/system/tier-billing-requirements`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const billingData = await response.json();

            const conversionResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/superadmin/system/points-conversion`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const conversionData = await conversionResponse.json();

            if (billingData.tierBillingRequirements && conversionData.tierPointsConversion) {
                const updatedTierDetails = Object.keys(billingData.tierBillingRequirements).map((tierName) => ({
                    name: tierName,
                    billingRequirement: billingData.tierBillingRequirements[tierName],
                    conversionPoints: conversionData.tierPointsConversion[tierName] || 0,
                    color:
                        tierName === 'NoTier' ? 'lightcoral' :
                        tierName === 'Basic' ? '#ffdd8f' :
                        tierName === 'Bronze' ? '#F59F4A' :
                        tierName === 'Silver' ? '#BCC6CC' :
                        tierName === 'Gold' ? '#EFBF04' :
                        '#D3D6D8',
                }));
                setTierDetails(updatedTierDetails);
            }
        } catch (error) {
            console.error('Error fetching tier data:', error);
        }
    };

    const fetchUserBills = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/bill/user`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const bills = await response.json();

            const currentQuarter = getCurrentQuarter();
            const filteredBills = bills.filter((bill: any) => {
                const billDate = new Date(bill.billDate);
                return (
                    billDate.getFullYear() === currentQuarter.year &&
                    billDate.getMonth() >= currentQuarter.startMonth &&
                    billDate.getMonth() <= currentQuarter.endMonth
                );
            });

            const totalBilling = filteredBills.reduce((sum: number, bill: any) => sum + bill.billAmount, 0);
            setCurrentQuarterBilling(totalBilling);

            if (currentTier && tierDetails.length > 0) {
                const nextTierDetails = determineNextQuarterTier(currentTier, totalBilling);
                setNextQuarterTier(nextTierDetails.nextTier);
                setNextTierMessage(nextTierDetails.message);
            }
        } catch (error) {
            console.error('Error fetching user bills:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            await fetchUserData();
            await fetchTierData();
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (currentTier && tierDetails.length > 0) {
            fetchUserBills();
        }
    }, [currentTier, tierDetails]);

    if (loading) {
        return(
          <div className='loading'>  
         <div className='loader'></div>
         <p>Loading...</p>
         </div>
        )
    }

    return (
        <div className="tier-page">
            <h1>Your Tier Information</h1>
            <div className='tiers-info-holder'>
            <div className="tier-section current-tier">
                <h3>Current Tier</h3>
                <div className={`tier-box ${currentTier?.toLowerCase()}`}>
                    <section className='star-Img'>
                        {Array.from(
                            { length: 
                                currentTier === 'Basic' ? 1 : 
                                currentTier === 'Bronze' ? 2 : 
                                currentTier === 'Silver' ? 3 : 
                                currentTier === 'Gold' ? 4 : 
                                currentTier === 'Platinum' ? 5 : 0 
                            }
                        ).map((_, index) => (
                            <img
                                key={index}
                                style={{ marginLeft: '5px' }}
                                src={starImg}
                                alt="star"
                                height="13px"
                                width="13px"
                            />
                        ))}
                    </section>
                   <svg width="160px" height="320px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22c-1.148 0-3.418-1.362-5.13-3.34C4.44 15.854 3 11.967 3 7a1 1 0 0 1 .629-.929c3.274-1.31 5.88-2.613 7.816-3.903a1 1 0 0 1 1.11 0c1.935 1.29 4.543 2.594 7.816 3.903A1 1 0 0 1 21 7c0 4.968-1.44 8.855-3.87 11.66C15.419 20.637 13.149 22 12 22z" fill="currentColor"/></svg>
                    <p className={`shieldText ${currentTier?.toLowerCase()}`}>{currentTier ? breakStringOnCaps(currentTier) : 'No Tier'}</p>
                </div>
            </div>
            <img className='arrow-down-img' src={arrowDown} alt="arrow" height='100px' width='50px' />
            <div className="tier-section next-quarter-tier">
                <h3>Next Quarter's Tier</h3>
                <div className={`tier-box ${nextQuarterTier?.toLowerCase()}`}>
                <section className='star-Img'>
                        {Array.from(
                            { length: 
                                nextQuarterTier === 'Basic' ? 1 : 
                                nextQuarterTier === 'Bronze' ? 2 : 
                                nextQuarterTier === 'Silver' ? 3 : 
                                nextQuarterTier === 'Gold' ? 4 : 
                                nextQuarterTier === 'Platinum' ? 5 : 0 
                            }
                        ).map((_, index) => (
                            <img
                                key={index}
                                style={{ marginLeft: '5px' }}
                                src={starImg}
                                alt="star"
                                height="13px"
                                width="13px"
                            />
                        ))}
                    </section>
                    <svg width="160px" height="320px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22c-1.148 0-3.418-1.362-5.13-3.34C4.44 15.854 3 11.967 3 7a1 1 0 0 1 .629-.929c3.274-1.31 5.88-2.613 7.816-3.903a1 1 0 0 1 1.11 0c1.935 1.29 4.543 2.594 7.816 3.903A1 1 0 0 1 21 7c0 4.968-1.44 8.855-3.87 11.66C15.419 20.637 13.149 22 12 22z" fill="currentColor"/></svg>
                    <p className={`shieldText ${nextQuarterTier?.toLowerCase()}`}>{nextQuarterTier ? breakStringOnCaps(nextQuarterTier) : 'No Tier'}</p>
                </div>
            </div>
            </div>           
                {nextTierMessage && <p className='message-text'>{nextTierMessage}</p>}
            <div className="tier-section">
                <h3>Billing in Current Quarter</h3>
                <p className='quarter-billling'>₹{currentQuarterBilling.toLocaleString('en-IN')}</p>
            </div>

            <div className="">
                <h2>Tier Details</h2>
                <table className="tier-table">
                    <thead>
                        <tr>
                            <th>Tier</th>
                            <th>Billing Requirement</th>
                            <th>Points per Billing</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tierDetails.map((tier) => {
                            if (tier.name === 'NoTier') return null;
                            const achieved = currentQuarterBilling >= tier.billingRequirement;
                            const isNextQuarterTier = nextQuarterTier === tier.name;

                            return (
                                <tr
                                    key={tier.name}
                                    style={{
                                        backgroundColor: tier.color,
                                        border: isNextQuarterTier ? '3px solid #145c49' : 'none',
                                        borderRadius: isNextQuarterTier ? '5px' : 'none',
                                    }}
                                >
                                    <td>{tier.name}</td>
                                    <td>₹{tier.billingRequirement.toLocaleString('en-IN')}</td>
                                    <td>{tier.conversionPoints}</td>
                                    <td>
                                        {achieved ? (
                                            <span className="tick">✔</span>
                                        ) : (
                                            `₹${(tier.billingRequirement - currentQuarterBilling).toLocaleString('en-IN')} left`
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="tier-terms">
                <h3>Terms and Conditions</h3>
                <p>• Partners will be upgraded or downgraded from tiers every quarter depending on past quarter billing.</p>
                <p>• Once the partner is in a particular tier, they will earn points according to the tier benefits.</p>
            </div>
        </div>
    );
};

export default TierPage;
