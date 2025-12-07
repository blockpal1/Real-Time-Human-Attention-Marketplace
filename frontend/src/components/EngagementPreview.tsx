import React, { useState, useEffect } from 'react';
import { wsClient } from '../services/wsClient';

export const EngagementPreview: React.FC = () => {
    const [score, setScore] = useState(0.85);
    const [emoji, setEmoji] = useState('😐');

    useEffect(() => {
        const unsub = wsClient.subscribe('engagement', (data: any) => {
            // Mock parsing logic
            setScore(data.score || Math.random());
            setEmoji(data.microExpression || '😐');
        });
        return () => { if (unsub) unsub(); };
    }, []);

    return (
        <div style={{
            background: '#1a1f3a',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            marginBottom: '20px',
            border: '1px solid #444'
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ccc' }}>Live Engagement</h3>
            <div style={{ fontSize: '3em' }}>{emoji}</div>
            <div style={{
                marginTop: '10px',
                height: '10px',
                background: '#333',
                borderRadius: '5px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${score * 100}%`,
                    height: '100%',
                    background: score > 0.7 ? '#00FF41' : score > 0.4 ? 'orange' : 'red',
                    transition: 'width 0.3s ease'
                }} />
            </div>
            <div style={{ marginTop: '5px', color: '#888' }}>
                Score: {(score * 100).toFixed(0)}%
            </div>
        </div>
    );
};
