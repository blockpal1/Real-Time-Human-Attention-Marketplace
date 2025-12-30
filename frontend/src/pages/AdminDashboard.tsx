import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';

interface PlatformStatus {
    platform_mode: string;
    stats: {
        total_agents: number;
        active_bids: number;
        pending_builder_codes: number;
        flagged_content: number;
    };
    updated_at: string;
}

interface BuilderCode {
    code: string;
    balance: number;
    owner_email: string;
    description: string;
    payout_wallet: string;
    created_at: number;
    status: string;
}

interface X402FlaggedOrder {
    tx_hash: string;
    content_url: string | null;
    validation_question: string;
    status: string;
    bid_per_second: number;
    duration: number;
    quantity: number;
    created_at: number;
}

export const AdminDashboard: React.FC = () => {
    const [adminSecret, setAdminSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [status, setStatus] = useState<PlatformStatus | null>(null);
    const [builderCodes, setBuilderCodes] = useState<BuilderCode[]>([]);
    const [x402FlaggedOrders, setX402FlaggedOrders] = useState<X402FlaggedOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // New builder code form
    const [newCode, setNewCode] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newPayoutWallet, setNewPayoutWallet] = useState('');

    const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/status`, { headers });
            if (!res.ok) throw new Error('Unauthorized');
            const data = await res.json();
            setStatus(data);
            setIsAuthenticated(true);
            setError('');
        } catch {
            setError('Invalid admin secret');
            setIsAuthenticated(false);
        }
    };

    const fetchBuilderCodes = async () => {
        const res = await fetch(`${API_URL}/admin/builders`, { headers });
        if (res.ok) {
            const data = await res.json();
            setBuilderCodes(data.builders || []);
        }
    };

    const fetchX402FlaggedContent = async () => {
        const res = await fetch(`${API_URL}/admin/content/x402-flagged`, { headers });
        if (res.ok) {
            const data = await res.json();
            setX402FlaggedOrders(data.orders || []);
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        await fetchStatus();
        if (isAuthenticated) {
            await Promise.all([fetchBuilderCodes(), fetchX402FlaggedContent()]);
        }
        setLoading(false);
    };

    const changeMode = async (mode: string) => {
        setLoading(true);
        await fetch(`${API_URL}/admin/mode`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ mode })
        });
        await fetchStatus();
        setLoading(false);
    };

    const createBuilderCode = async () => {
        if (!newCode) return;
        setLoading(true);
        await fetch(`${API_URL}/admin/builders/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                code: newCode,
                owner_email: newEmail,
                description: newDescription,
                payout_wallet: newPayoutWallet || undefined
            })
        });
        setNewCode('');
        setNewEmail('');
        setNewDescription('');
        setNewPayoutWallet('');
        await fetchBuilderCodes();
        await fetchStatus();
        setLoading(false);
    };

    const reviewX402Content = async (txHash: string, action: 'approve' | 'reject') => {
        setLoading(true);
        await fetch(`${API_URL}/admin/content/x402/${txHash}/review`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action })
        });
        await fetchX402FlaggedContent();
        await fetchStatus();
        setLoading(false);
    };

    const sweepPlatformFees = async () => {
        if (!confirm('Are you sure you want to sweep all accumulated protocol fees to the admin wallet?')) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/fees/sweep`, {
                method: 'POST',
                headers
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Success! Fees swept. Tx: ${data.tx_hash}`);
            } else {
                throw new Error(data.error || 'Failed to sweep fees');
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchBuilderCodes();
            fetchX402FlaggedContent();
        }
    }, [isAuthenticated]);

    // Styles
    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        maxHeight: '100vh',
        overflowY: 'auto',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        color: '#fff',
        padding: '40px',
        fontFamily: 'Inter, system-ui, sans-serif'
    };

    const cardStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
    };

    const buttonStyle = (active?: boolean): React.CSSProperties => ({
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        marginRight: '8px',
        background: active ? '#6366f1' : 'rgba(255,255,255,0.1)',
        color: active ? '#fff' : '#aaa',
        transition: 'all 0.2s'
    });

    const inputStyle: React.CSSProperties = {
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.3)',
        color: '#fff',
        fontSize: '14px',
        width: '100%',
        marginBottom: '12px'
    };

    const statBoxStyle: React.CSSProperties = {
        textAlign: 'center',
        padding: '20px',
        background: 'rgba(99,102,241,0.1)',
        borderRadius: '12px',
        flex: 1,
        margin: '0 8px'
    };

    if (!isAuthenticated) {
        return (
            <div style={containerStyle}>
                <div style={{ maxWidth: '400px', margin: '100px auto' }}>
                    <button
                        onClick={() => window.location.hash = '#app'}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', padding: 0 }}
                    >
                        ← App
                    </button>
                    <h1 style={{ marginBottom: '32px', fontSize: '28px' }}>🔐 Admin Console</h1>
                    <div style={cardStyle}>
                        <input
                            type="password"
                            placeholder="Enter Admin Secret"
                            value={adminSecret}
                            onChange={(e) => setAdminSecret(e.target.value)}
                            style={inputStyle}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        {error && <p style={{ color: '#ef4444', marginBottom: '12px' }}>{error}</p>}
                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            style={{ ...buttonStyle(true), width: '100%' }}
                        >
                            {loading ? 'Authenticating...' : 'Login'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <button
                    onClick={() => window.location.hash = '#app'}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', padding: 0 }}
                >
                    ← App
                </button>
                <h1 style={{ marginBottom: '8px', fontSize: '32px' }}>⚙️ Admin Console</h1>
                <p style={{ color: '#888', marginBottom: '32px' }}>Attentium Platform Management</p>

                {/* Platform Status */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Platform Status</h2>

                    <div style={{ display: 'flex', marginBottom: '24px' }}>
                        <div style={statBoxStyle}>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#6366f1' }}>
                                {status?.stats.total_agents || 0}
                            </div>
                            <div style={{ color: '#888', fontSize: '14px' }}>Agents</div>
                        </div>
                        <div style={statBoxStyle}>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
                                {status?.stats.active_bids || 0}
                            </div>
                            <div style={{ color: '#888', fontSize: '14px' }}>Active Bids</div>
                        </div>
                        <div style={statBoxStyle}>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b' }}>
                                {status?.stats.pending_builder_codes || 0}
                            </div>
                            <div style={{ color: '#888', fontSize: '14px' }}>Pending Codes</div>
                        </div>
                        <div style={statBoxStyle}>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>
                                {status?.stats.flagged_content || 0}
                            </div>
                            <div style={{ color: '#888', fontSize: '14px' }}>Flagged Content</div>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Platform Mode</h3>
                    <div>
                        {['beta', 'hybrid', 'live'].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => changeMode(mode)}
                                disabled={loading}
                                style={buttonStyle(status?.platform_mode === mode)}
                            >
                                {mode.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '12px' }}>
                        {status?.platform_mode === 'beta' && '💡 Sandbox mode: Points for users, no escrow required'}
                        {status?.platform_mode === 'hybrid' && '🔄 Hybrid mode: Both points and real payments active'}
                        {status?.platform_mode === 'live' && '💰 Live mode: Real USDC escrow and payments only'}
                    </p>
                </div>

                {/* Protocol Fees */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>💰 Protocol Fees</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>
                                Accumulated fees in the Fee Vault can be swept to the Admin Wallet.
                            </p>
                            <p style={{ color: '#666', fontSize: '12px' }}>
                                Destination: <code>{adminSecret ? '(Admin Keypair Wallet)' : '...'}</code>
                            </p>
                        </div>
                        <button
                            onClick={sweepPlatformFees}
                            disabled={loading}
                            style={{ ...buttonStyle(true), background: '#10b981', marginLeft: '20px' }}
                        >
                            {loading ? 'Sweeping...' : 'Sweep Fees'}
                        </button>
                    </div>
                </div>

                {/* Genesis Builder Codes */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>🔑 Genesis Builder Codes</h2>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <input
                            placeholder="Code (e.g., LANGCHAIN)"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }}
                        />
                        <input
                            placeholder="Owner Email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }}
                        />
                        <input
                            placeholder="Payout Wallet (Solana)"
                            value={newPayoutWallet}
                            onChange={(e) => setNewPayoutWallet(e.target.value)}
                            style={{ ...inputStyle, flex: 1, minWidth: '160px', marginBottom: 0, fontFamily: 'monospace', fontSize: '11px' }}
                        />
                        <input
                            placeholder="Description"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            style={{ ...inputStyle, flex: 2, minWidth: '160px', marginBottom: 0 }}
                        />
                        <button
                            onClick={createBuilderCode}
                            disabled={loading || !newCode}
                            style={buttonStyle(true)}
                        >
                            Create
                        </button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Code</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Owner</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Wallet</th>
                                <th style={{ textAlign: 'right', padding: '12px', color: '#888' }}>Balance</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {builderCodes.map((bc) => (
                                <tr key={bc.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{bc.code}</td>
                                    <td style={{ padding: '12px', fontSize: '12px' }}>
                                        {bc.owner_email || '-'}
                                    </td>
                                    <td style={{ padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: bc.payout_wallet === 'pending' ? '#f59e0b' : '#aaa' }}>
                                        {bc.payout_wallet === 'pending' ? 'pending' : `${bc.payout_wallet.slice(0, 4)}...${bc.payout_wallet.slice(-4)}`}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: bc.balance > 0 ? '#22c55e' : '#666' }}>
                                        ${bc.balance.toFixed(4)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            background: bc.status === 'active' ? '#22c55e' : '#f59e0b'
                                        }}>
                                            {bc.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {builderCodes.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                                        No builder codes yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* x402 Flagged Content */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>⚠️ x402 Flagged Orders (ToS Rejected)</h2>

                    {x402FlaggedOrders.length === 0 ? (
                        <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>
                            ✅ No x402 orders flagged for ToS violations
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>TX Hash</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Content</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Bid</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {x402FlaggedOrders.map((order) => (
                                    <tr key={order.tx_hash} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>
                                            {order.tx_hash.slice(0, 16)}...
                                        </td>
                                        <td style={{ padding: '12px', maxWidth: '300px' }}>
                                            {order.content_url && (
                                                <a href={order.content_url} target="_blank" rel="noreferrer"
                                                    style={{ color: '#6366f1' }}>
                                                    {order.content_url.slice(0, 40)}...
                                                </a>
                                            )}
                                            {order.validation_question && (
                                                <p style={{ fontSize: '12px', color: '#888', margin: '4px 0' }}>
                                                    Q: {order.validation_question}
                                                </p>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                            ${order.bid_per_second.toFixed(4)}/s
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                background: '#ef4444'
                                            }}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                onClick={() => reviewX402Content(order.tx_hash, 'approve')}
                                                disabled={loading}
                                                style={{ ...buttonStyle(true), padding: '6px 12px', fontSize: '12px', marginRight: '4px' }}
                                            >
                                                Approve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <p style={{ textAlign: 'center', color: '#444', fontSize: '12px', marginTop: '40px' }}>
                    Attentium Admin Console • Environment: {status?.platform_mode}
                </p>
            </div>
        </div>
    );
};

export default AdminDashboard;
