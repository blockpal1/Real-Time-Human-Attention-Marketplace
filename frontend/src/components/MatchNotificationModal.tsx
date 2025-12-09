import React, { useEffect, useState } from 'react';

interface MatchNotificationModalProps {
    match: {
        matchId: string;
        price: number;
        duration: number;
        topic?: string | object;
    };
    onAccept: () => void;
    onDismiss: () => void;
}

const HANDSHAKE_TIMEOUT = 10;

export const MatchNotificationModal: React.FC<MatchNotificationModalProps> = ({ match, onAccept, onDismiss }) => {
    const [countdown, setCountdown] = useState(HANDSHAKE_TIMEOUT);

    const topicDisplay = typeof match.topic === 'string' ? match.topic : 'New Match';

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onDismiss();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onDismiss]);

    // Using inline styles to avoid any Tailwind issues
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.9)'
        }}>
            {/* Modal Card */}
            <div style={{
                backgroundColor: '#0a0a0a',
                border: '2px solid #00FF41',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 0 60px rgba(0,255,65,0.4)',
                textAlign: 'center'
            }}>
                {/* Countdown */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: `4px solid ${countdown <= 3 ? '#ff4444' : '#00FF41'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '32px',
                    fontFamily: 'monospace',
                    color: countdown <= 3 ? '#ff4444' : '#00FF41',
                    fontWeight: 'bold'
                }}>
                    {countdown}
                </div>

                <div style={{ color: '#00FF41', fontSize: '12px', letterSpacing: '2px', marginBottom: '8px' }}>
                    ⚡ MATCH DETECTED
                </div>

                <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '24px' }}>
                    {topicDisplay}
                </h2>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>RATE</div>
                        <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace' }}>
                            ${match.price.toFixed(4)}/s
                        </div>
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>DURATION</div>
                        <div style={{ color: 'white', fontSize: '20px', fontFamily: 'monospace' }}>
                            {match.duration}s
                        </div>
                    </div>
                </div>

                {/* Earnings */}
                <div style={{
                    backgroundColor: 'rgba(0,255,65,0.1)',
                    border: '1px solid rgba(0,255,65,0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ color: '#888', fontSize: '12px' }}>EST. EARNINGS</span>
                    <span style={{ color: '#00FF41', fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        ${(match.price * match.duration).toFixed(4)}
                    </span>
                </div>

                {/* Actions */}
                <button
                    onClick={onAccept}
                    style={{
                        width: '100%',
                        backgroundColor: '#00FF41',
                        color: 'black',
                        fontWeight: 'bold',
                        padding: '16px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        marginBottom: '12px'
                    }}
                >
                    ACCEPT & FOCUS
                </button>
                <button
                    onClick={onDismiss}
                    style={{
                        width: '100%',
                        backgroundColor: 'transparent',
                        color: '#888',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Dismiss Offer
                </button>
            </div>
        </div>
    );
};
