import React, { useEffect, useState } from 'react';
import { AIBid } from '../types/AIBid';
import { wsClient } from '../services/wsClient';
import { api } from '../services/api';

export const AIBidList: React.FC = () => {
    const [bids, setBids] = useState<AIBid[]>([]);

    useEffect(() => {
        // 1. Initial Fetch
        const fetchBids = async () => {
            try {
                const activeBids = await api.getActiveBids();
                // Map Backend API format to Frontend AIBid format
                const mappedBids: AIBid[] = activeBids.map((b: any) => ({
                    id: b.id,
                    agentName: 'Agent ' + (b.id ? b.id.slice(0, 4) : 'X'),
                    // Backend sends micros (int), frontend wants USDC (float)
                    bidPerSecond: (b.maxPricePerSecond || 0) / 1_000_000,
                    taskDescription: b.validationQuestion || 'View Content',
                    taskLength: b.durationPerUser || 30,
                    priority: 1
                }));
                setBids(mappedBids);
            } catch (e) {
                console.error('Failed to fetch bids:', e);
            }
        };

        fetchBids();

        // 2. WebSocket Subscription
        const unsub = wsClient.subscribe('BID_CREATED', (event: any) => {
            console.log('New Bid Event:', event);
            // Payload might be in event directly or event.payload depending on WS manager
            const data = event.payload || event;

            const newBid: AIBid = {
                id: data.id || data.bidId || Date.now().toString(),
                agentName: 'Agent ' + (data.id ? data.id.slice(0, 4) : 'New'),
                // Handle various likely price keys from different event sources
                bidPerSecond: (data.maxPricePerSecond || data.max_price_per_second || 0) / 1_000_000,
                taskDescription: data.validationQuestion || data.validation_question || 'View Ad',
                taskLength: data.durationPerUser || data.duration || 30,
                priority: 1
            };

            // Avoid duplicates
            setBids(prev => {
                if (prev.find(b => b.id === newBid.id)) return prev;
                return [newBid, ...prev].slice(0, 50);
            });
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
