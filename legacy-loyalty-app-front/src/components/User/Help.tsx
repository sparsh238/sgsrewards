import React from 'react';
import './Help.css';

const Help: React.FC = () => {
    return (
        <div className="help-container">
            <h3>For any queries and order cancellation contact:</h3>
            <div className="contact-card">
                <h2>Sparsh Arora</h2>
                <p>MD, Samsung Distribution</p>
                <p>+91-8875765648</p>
            </div>
            <div className="contact-card">
                <h2>Manoj Singh</h2>
                <p>Senior Manager, Oppo Distribution</p>
                <p>+91-9828398047</p>
            </div>
            <div className="contact-card">
                <h2>Hitesh Gandhi</h2>
                <p>Senior Manager, Samsung Distribution</p>
                <p>+91-9887353375</p>
            </div>
        </div>
    );
};

export default Help;
