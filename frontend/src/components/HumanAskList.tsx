import React, { useEffect, useState } from 'react';
import { HumanAsk } from '../types/HumanAsk';
import { wsClient } from '../services/wsClient';

export const HumanAskList: React.FC = () => {
    const [asks, setAsks] = useState<HumanAsk[]>([]);

    useEffect(() => {
        // Subscribe to ask updates (simulated for now as we don't have this stream yet)
        const unsub = wsClient.subscribe('ask', (data) => {
            setAsks(prev => [...prev.slice(-9), data]);
        });
        return () => { if (unsub) unsub(); };
    }, []);

    // Sort asks ascending by price (lowest ask first)
    const sortedAsks = [...asks].sort((a, b) => a.pricePerSecond - b.pricePerSecond);

    return (
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#FF4141', marginBottom: '15px', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Asks (Sell Orders)
            </h2>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #333', color: '#666', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Price (USDC/s)</th>
                            <th style={{ padding: '8px' }}>User</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAsks.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#444' }}>
                                    Waiting for asks...
                                </td>
                            </tr>
                        )}
                        {sortedAsks.map((ask, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1a1f3a' }}>
                                <td style={{ padding: '8px', color: '#FF4141', fontWeight: 'bold' }}>
                                    {(ask.pricePerSecond).toFixed(4)}
                                </td>
                                <td style={{ padding: '8px', color: '#ccc' }}>
                                    User {ask.id.slice(0, 4)}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                    <button
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #FF4141',
                                            color: '#FF4141',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            opacity: 0.7
                                        }}
                                        disabled
                                    >
                                        BUY
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
