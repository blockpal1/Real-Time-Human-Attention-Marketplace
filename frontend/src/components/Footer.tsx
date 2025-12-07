import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer style={{
            padding: '20px',
            textAlign: 'center',
            borderTop: '1px solid #333',
            color: '#666',
            marginTop: 'auto',
            background: '#0F111A'
        }}>
            <div>Total Volume: $1,240.50 | Active Agents: 12</div>
            <div style={{ fontSize: '0.8em', marginTop: '5px' }}>Powered by Solana • Privately Verified</div>
        </footer>
    );
};
