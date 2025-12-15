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
    id: string;
    code: string;
    builder_pubkey: string;
    tier: string;
    revenue_share_bps: number;
    total_volume: string;
    created_at: string;
    approved_at: string | null;
}

interface FlaggedBid {
    bid_id: string;
    content_url: string | null;
    target_url: string | null;
    validation_question: string | null;
    content_status: string;
    agent: { pubkey: string; name: string | null; tier: string } | null;
    created_at: string;
}

export const AdminDashboard: React.FC = () => {
    const [adminSecret, setAdminSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [status, setStatus] = useState<PlatformStatus | null>(null);
    const [builderCodes, setBuilderCodes] = useState<BuilderCode[]>([]);
    const [flaggedBids, setFlaggedBids] = useState<FlaggedBid[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // New builder code form
    const [newCode, setNewCode] = useState('');
    const [newPubkey, setNewPubkey] = useState('');

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
        const res = await fetch(`${API_URL}/admin/builder-codes`, { headers });
        if (res.ok) setBuilderCodes(await res.json());
    };

    const fetchFlaggedContent = async () => {
        const res = await fetch(`${API_URL}/admin/content/flagged`, { headers });
        if (res.ok) setFlaggedBids(await res.json());
    };

    const handleLogin = async () => {
        setLoading(true);
        await fetchStatus();
        if (isAuthenticated) {
            await Promise.all([fetchBuilderCodes(), fetchFlaggedContent()]);
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
        if (!newCode || !newPubkey) return;
        setLoading(true);
        await fetch(`${API_URL}/admin/builder-codes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                code: newCode,
                builder_pubkey: newPubkey,
                tier: 'genesis'
            })
        });
        setNewCode('');
        setNewPubkey('');
        await fetchBuilderCodes();
        await fetchStatus();
        setLoading(false);
    };

    const reviewBuilderCode = async (codeId: string, action: 'approve' | 'reject') => {
        setLoading(true);
        await fetch(`${API_URL}/admin/builder-codes/${codeId}/review`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action })
        });
        await fetchBuilderCodes();
        await fetchStatus();
        setLoading(false);
    };

    const reviewContent = async (bidId: string, action: 'approve' | 'reject') => {
        setLoading(true);
        await fetch(`${API_URL}/admin/content/${bidId}/review`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action })
        });
        await fetchFlaggedContent();
        await fetchStatus();
        setLoading(false);
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchBuilderCodes();
            fetchFlaggedContent();
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

                {/* Genesis Builder Codes */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>🔑 Genesis Builder Codes</h2>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <input
                            placeholder="Code (e.g., langchain)"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value)}
                            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        <input
                            placeholder="Builder Wallet Pubkey"
                            value={newPubkey}
                            onChange={(e) => setNewPubkey(e.target.value)}
                            style={{ ...inputStyle, flex: 2, marginBottom: 0 }}
                        />
                        <button
                            onClick={createBuilderCode}
                            disabled={loading || !newCode || !newPubkey}
                            style={buttonStyle(true)}
                        >
                            Create
                        </button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Code</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Builder</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Tier</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Share</th>
                                <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {builderCodes.map((code) => (
                                <tr key={code.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', fontWeight: 600 }}>{code.code}</td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>
                                        {code.builder_pubkey.slice(0, 12)}...
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            background: code.tier === 'genesis' ? '#6366f1' :
                                                code.tier === 'pending' ? '#f59e0b' : '#22c55e'
                                        }}>
                                            {code.tier}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>{code.revenue_share_bps / 100}%</td>
                                    <td style={{ padding: '12px' }}>
                                        {code.tier === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => reviewBuilderCode(code.id, 'approve')}
                                                    style={{ ...buttonStyle(true), padding: '6px 12px', fontSize: '12px' }}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => reviewBuilderCode(code.id, 'reject')}
                                                    style={{ ...buttonStyle(), padding: '6px 12px', fontSize: '12px', background: '#ef4444' }}
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
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

                {/* Flagged Content */}
                <div style={cardStyle}>
                    <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>🚨 Flagged Content</h2>

                    {flaggedBids.length === 0 ? (
                        <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>
                            ✅ No flagged content to review
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Bid ID</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Content</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Agent</th>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#888' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flaggedBids.map((bid) => (
                                    <tr key={bid.bid_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>
                                            {bid.bid_id.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '12px', maxWidth: '400px' }}>
                                            {bid.content_url && (
                                                <a href={bid.content_url} target="_blank" rel="noreferrer"
                                                    style={{ color: '#6366f1' }}>
                                                    {bid.content_url.slice(0, 50)}...
                                                </a>
                                            )}
                                            {bid.validation_question && (
                                                <p style={{ fontSize: '12px', color: '#888', margin: '4px 0' }}>
                                                    Q: {bid.validation_question}
                                                </p>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {bid.agent?.name || bid.agent?.pubkey.slice(0, 12) || 'Unknown'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                onClick={() => reviewContent(bid.bid_id, 'approve')}
                                                style={{ ...buttonStyle(true), padding: '6px 12px', fontSize: '12px' }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => reviewContent(bid.bid_id, 'reject')}
                                                style={{ ...buttonStyle(), padding: '6px 12px', fontSize: '12px', background: '#ef4444' }}
                                            >
                                                Reject
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
