import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWallets } from '@privy-io/react-auth';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Helper to ensure Buffer is available
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

interface EarningsDashboardProps {
    userPubkey: string;
    isOpen: boolean;
    onClose: () => void;
}

export const EarningsDashboard: React.FC<EarningsDashboardProps> = ({ userPubkey, isOpen, onClose }) => {
    const [earnings, setEarnings] = useState<any>(null);
    const [unclaimed, setUnclaimed] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);

    const { wallets } = useWallets();

    useEffect(() => {
        if (isOpen && userPubkey) {
            loadData();
        }
    }, [isOpen, userPubkey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [earningsData, historyData, claimData] = await Promise.all([
                api.getUserEarnings(userPubkey),
                api.getSessionHistory(userPubkey, 20),
                api.getClaimBalance(userPubkey)
            ]);
            setEarnings(earningsData);
            setHistory(historyData);
            setUnclaimed(claimData);
        } catch (error) {
            console.error('Failed to load earnings data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!unclaimed || unclaimed.usdc_balance <= 0.01) return;
        setClaiming(true);

        try {
            // 1. Request TX from Backend
            const { transaction, claimId, error } = await api.withdrawEarnings(userPubkey);
            if (error) throw new Error(error);

            // 2. Deserialize
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            // 3. Sign with Wallet
            const wallet = wallets.find(w => w.address === userPubkey) || wallets[0];
            if (!wallet) throw new Error("Wallet not connected");

            // Privy signTransaction returns the signed transaction object
            const signedTx = await (wallet as any).signTransaction(tx);

            // 4. Serialize Signed TX
            const signedBase64 = signedTx.serialize().toString('base64');

            // 5. Submit to Backend for broadcasting/finalizing
            await api.submitClaim(userPubkey, claimId, signedBase64);

            alert("Claim Successful! Funds will arrive shortly.");
            await loadData(); // Refresh UI

        } catch (e: any) {
            console.error(e);
            alert(`Claim Failed: ${e.message}`);
        } finally {
            setClaiming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)' }} onClick={onClose}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 0 40px rgba(0,255,65,0.2)' }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>💰 YOUR EARNINGS</h2>
                    <button onClick={onClose} style={{ backgroundColor: 'transparent', color: '#666', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading...</div>
                ) : earnings ? (
                    <>
                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>TODAY</div>
                                <div style={{ color: '#00FF41', fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold' }}>${earnings.today.toFixed(4)}</div>
                                <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>{earnings.sessionsToday} sessions</div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>THIS WEEK</div>
                                <div style={{ color: '#00FF41', fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold' }}>${earnings.week.toFixed(4)}</div>
                                <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>{earnings.sessionsWeek} sessions</div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>ALL TIME</div>
                                <div style={{ color: '#00FF41', fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold' }}>${earnings.allTime.toFixed(4)}</div>
                                <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>{earnings.sessionsAllTime} sessions</div>
                                <div style={{ color: '#00FF41', fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold' }}>${earnings.allTime.toFixed(4)}</div>
                                <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>{earnings.sessionsAllTime} sessions</div>
                            </div>
                        </div>

                        {/* Unclaimed Balance & Action */}
                        {unclaimed && (
                            <div style={{ backgroundColor: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ color: '#888', fontSize: '10px', letterSpacing: '1px', marginBottom: '4px' }}>AVAILABLE TO CLAIM</div>
                                    <div style={{ color: '#00FF41', fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        ${unclaimed.usdc_balance.toFixed(4)} <span style={{ fontSize: '14px', color: '#666' }}>USDC</span>
                                    </div>
                                    <div style={{ color: '#555', fontSize: '10px' }}>
                                        Processing: {unclaimed.pending_items || 0} items
                                    </div>
                                </div>
                                <button
                                    onClick={handleClaim}
                                    disabled={claiming || unclaimed.usdc_balance < 0.01}
                                    style={{
                                        backgroundColor: claiming || unclaimed.usdc_balance < 0.01 ? '#222' : '#00FF41',
                                        color: claiming || unclaimed.usdc_balance < 0.01 ? '#666' : 'black',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '10px 20px',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        cursor: claiming || unclaimed.usdc_balance < 0.01 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {claiming ? 'PROCESSING...' : unclaimed.usdc_balance < 0.01 ? 'MIN $0.01' : 'CLAIM NOW'}
                                </button>
                            </div>
                        )}

                        {/* Session History */}
                        <div style={{ marginTop: '24px' }}>
                            <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '12px', letterSpacing: '1px' }}>RECENT SESSIONS</h3>
                            {history.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '14px' }}>
                                    No sessions yet. Start earning by accepting matches!
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {history.map((session) => (
                                        <div key={session.matchId} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: 'white', fontSize: '12px', marginBottom: '4px' }}>{session.question}</div>
                                                <div style={{ color: '#666', fontSize: '10px' }}>
                                                    Your answer: "{session.answer.slice(0, 40)}{session.answer.length > 40 ? '...' : ''}"
                                                </div>
                                                <div style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>
                                                    {new Date(session.completedAt).toLocaleString()}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                                                <div style={{ color: '#00FF41', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                    +${session.earned.toFixed(4)}
                                                </div>
                                                <div style={{ color: '#00FF41', fontSize: '10px', marginTop: '2px' }}>✅ Paid</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Failed to load earnings data</div>
                )}
            </div>
        </div>
    );
};
