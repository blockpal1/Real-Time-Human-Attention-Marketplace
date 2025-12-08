import React, { useState } from 'react';
import { api } from '../services/api';

interface PriceFloorSetterProps {
    duration: number;
    setDuration: (d: number) => void;
}

export const PriceFloorSetter: React.FC<PriceFloorSetterProps> = ({ duration, setDuration }) => {
    const [price, setPrice] = useState(50);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Mock pubkey for demo (Privy crashing)
            const pubkey = 'test-user-consistent';
            await api.startSession(pubkey, Math.floor(price * 1_000_000));

            // Visual feedback handled by WS stream
            alert("Ask Posted to Order Book!");
        } catch (e) {
            console.error(e);
            alert('Failed to post ask');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: '#1a1f3a',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #00AAFF'
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#00AAFF' }}>Your Ask Price</h3>

            {/* Duration Selector for Humans */}
            <div className="mb-4">
                <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.8em', textTransform: 'uppercase' }}>Session Duration</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    {[10, 30, 60].map(s => (
                        <button
                            key={s}
                            onClick={() => setDuration(s)}
                            style={{
                                flex: 1,
                                padding: '5px',
                                border: '1px solid',
                                borderColor: duration === s ? '#00AAFF' : '#333',
                                background: duration === s ? 'rgba(0, 170, 255, 0.1)' : 'transparent',
                                color: duration === s ? '#00AAFF' : '#888',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                cursor: 'pointer'
                            }}
                        >
                            {s}s
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <input
                    type="range"
                    min="1"
                    max="500"
                    value={price}
                    onChange={(e: any) => setPrice(Number(e.target.value))}
                    style={{ flex: 1 }}
                />
                <div style={{
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    color: 'white',
                    minWidth: '100px'
                }}>
                    {(price / 1000000).toFixed(4)} USDC/s
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                    width: '100%',
                    background: '#00AAFF',
                    color: '#0a0e27',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                }}
            >
                {loading ? 'Posting...' : 'Post Ask to Order Book'}
            </button>

            <div style={{ fontSize: '0.8em', color: '#888', marginTop: '10px' }}>
                Minimum price per second
            </div>
        </div>
    );
};
