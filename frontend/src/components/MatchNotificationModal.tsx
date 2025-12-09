import React, { useEffect, useState, useCallback } from 'react';

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

type Phase = 'matching' | 'preparing' | 'expanding' | 'focused';
const HANDSHAKE_TIMEOUT = 10;
const PREP_COUNTDOWN = 3;

export const MatchNotificationModal: React.FC<MatchNotificationModalProps> = ({ match, onAccept, onDismiss }) => {
    const [phase, setPhase] = useState<Phase>('matching');
    const [countdown, setCountdown] = useState(HANDSHAKE_TIMEOUT);
    const [prepCountdown, setPrepCountdown] = useState(PREP_COUNTDOWN);
    const [sessionTime, setSessionTime] = useState(match.duration);

    const topicDisplay = typeof match.topic === 'string' ? match.topic : 'Ad Campaign';
    const totalEarnings = match.price * match.duration;

    // Matching phase countdown
    useEffect(() => {
        if (phase !== 'matching') return;
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
    }, [phase, onDismiss]);

    // Preparation phase countdown
    useEffect(() => {
        if (phase !== 'preparing') return;
        const timer = setInterval(() => {
            setPrepCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setPhase('expanding');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    // Expansion animation timing
    useEffect(() => {
        if (phase !== 'expanding') return;
        const timer = setTimeout(() => setPhase('focused'), 800);
        return () => clearTimeout(timer);
    }, [phase]);

    // Focus session timer
    useEffect(() => {
        if (phase !== 'focused') return;
        const timer = setInterval(() => {
            setSessionTime(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const handleAccept = useCallback(() => setPhase('preparing'), []);
    const handleEndSession = useCallback(() => onAccept(), [onAccept]);

    const getModalStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            backgroundColor: '#0a0a0a',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        };
        if (phase === 'matching' || phase === 'preparing') {
            return { ...base, border: '2px solid #00FF41', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', boxShadow: '0 0 60px rgba(0,255,65,0.4)' };
        }
        return { ...base, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', borderRadius: 0, border: 'none', padding: '48px' };
    };

    const renderContent = () => {
        if (phase === 'matching') {
            return (
                <>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `4px solid ${countdown <= 3 ? '#ff4444' : '#00FF41'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', fontSize: '32px', fontFamily: 'monospace', color: countdown <= 3 ? '#ff4444' : '#00FF41', fontWeight: 'bold' }}>
                        {countdown}
                    </div>
                    <div style={{ color: '#00FF41', fontSize: '12px', letterSpacing: '2px', marginBottom: '8px' }}>⚡ MATCH DETECTED</div>
                    <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '24px', textAlign: 'center' }}>{topicDisplay}</h2>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', width: '100%' }}>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>RATE</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace' }}>${match.price.toFixed(4)}/s</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>DURATION</div>
                            <div style={{ color: 'white', fontSize: '20px', fontFamily: 'monospace' }}>{match.duration}s</div>
                        </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ color: '#888', fontSize: '12px' }}>EST. EARNINGS</span>
                        <span style={{ color: '#00FF41', fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold' }}>${totalEarnings.toFixed(4)}</span>
                    </div>
                    <button onClick={handleAccept} style={{ width: '100%', backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '16px', borderRadius: '8px', border: 'none', fontSize: '16px', cursor: 'pointer', marginBottom: '12px' }}>ACCEPT & FOCUS</button>
                    <button onClick={onDismiss} style={{ width: '100%', backgroundColor: 'transparent', color: '#888', padding: '12px', borderRadius: '8px', border: '1px solid #333', fontSize: '12px', cursor: 'pointer' }}>Dismiss Offer</button>
                </>
            );
        }

        if (phase === 'preparing') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '120px', fontFamily: 'monospace', fontWeight: 'bold', color: '#00FF41', textShadow: '0 0 40px rgba(0,255,65,0.6)' }}>{prepCountdown}</div>
                    <div style={{ color: '#888', fontSize: '14px', letterSpacing: '4px', marginTop: '16px' }}>PREPARING SESSION...</div>
                </div>
            );
        }

        if (phase === 'expanding') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '60px', height: '60px', border: '3px solid #00FF41', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            );
        }

        // Focused phase
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ color: '#00FF41', fontSize: '10px', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%' }} />
                            FOCUS MODE
                        </div>
                        <div style={{ color: sessionTime <= 5 ? '#ff4444' : '#888', fontSize: '12px', fontFamily: 'monospace' }}>{sessionTime}s</div>
                    </div>
                    <button onClick={handleEndSession} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>EXIT</button>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 24px' }}>
                    {sessionTime > 0 ? (
                        <div style={{ textAlign: 'center', opacity: 0.3 }}>
                            <div style={{ color: '#333', fontSize: '14px', letterSpacing: '4px' }}>{topicDisplay.toUpperCase()}</div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                            <div style={{ color: '#00FF41', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>SESSION COMPLETE</div>
                            <div style={{ backgroundColor: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)', borderRadius: '8px', padding: '16px 32px', marginBottom: '16px', display: 'inline-block' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>YOU EARNED</div>
                                <div style={{ color: '#00FF41', fontSize: '32px', fontFamily: 'monospace', fontWeight: 'bold' }}>${totalEarnings.toFixed(4)}</div>
                            </div>
                            <div style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Thank you for your attention</div>
                            <button onClick={handleEndSession} style={{ backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>RETURN TO DASHBOARD</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: phase === 'focused' || phase === 'expanding' ? '#000' : 'rgba(0,0,0,0.9)', transition: 'background-color 0.8s ease' }}>
            <div style={getModalStyles()}>
                {renderContent()}
            </div>
        </div>
    );
};
