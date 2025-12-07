import React, { useEffect, useState } from 'react';
import { AIBid } from '../types/AIBid';
import { wsClient } from '../services/wsClient';

export const AIBidList: React.FC = () => {
    const [bids, setBids] = useState<AIBid[]>([]);

    useEffect(() => {
        const unsub = wsClient.subscribe('bid', (data: any) => {
            const newBid: AIBid = {
                id: data.bidId,
                agentName: 'Agent X',
                bidPerSecond: data.max_price_per_second,
                taskDescription: 'View Ad',
                taskLength: 30,
                priority: 1
            };
            setBids(prev => [newBid, ...prev].slice(0, 10));
        });
        return () => { if (unsub) unsub(); };
    }, []);

    // Sort bids descending by price (highest bid first)
    const sortedBids = [...bids].sort((a, b) => b.bidPerSecond - a.bidPerSecond);

    return (
        <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#00FF41', marginBottom: '15px', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Bids (Buy Orders)
            </h2>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #333', color: '#666', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Price (USDC/s)</th>
                            <th style={{ padding: '8px' }}>Agent</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBids.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#444' }}>
                                    Waiting for bids...
                                </td>
                            </tr>
                        )}
                        {sortedBids.map((bid) => (
                            <tr key={bid.id} style={{ borderBottom: '1px solid #1a1f3a', transition: 'background 0.2s' }}>
                                <td style={{ padding: '8px', color: '#00FF41', fontWeight: 'bold' }}>
                                    {(bid.bidPerSecond).toFixed(4)}
                                </td>
                                <td style={{ padding: '8px', color: '#ccc' }}>
                                    {bid.agentName}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => alert(`Accepted bid ${bid.id}. Settlement initiated!`)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #00FF41',
                                            color: '#00FF41',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#00FF41'; e.currentTarget.style.color = '#000'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00FF41'; }}
                                    >
                                        SELL
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
