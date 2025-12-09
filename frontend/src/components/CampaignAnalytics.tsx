import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface CampaignAnalyticsProps {
    agentPubkey: string;
}

export const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ agentPubkey }) => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [responses, setResponses] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
    }, [agentPubkey]);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            const data = await api.getAgentCampaigns(agentPubkey);
            setCampaigns(data);
        } catch (error) {
            console.error('Failed to load campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCampaignDetails = async (bidId: string) => {
        try {
            const data = await api.getCampaignResponses(bidId);
            setResponses(data);
        } catch (error) {
            console.error('Failed to load campaign details:', error);
        }
    };

    const handleCampaignClick = (campaign: any) => {
        setSelectedCampaign(campaign);
        loadCampaignDetails(campaign.bidId);
    };

    const exportToCSV = () => {
        if (!responses) return;

        const csv = [
            ['Answer', 'Timestamp'].join(','),
            ...responses.responses.raw.map((answer: string) => `"${answer}"`)
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign-${selectedCampaign?.bidId}-responses.csv`;
        a.click();
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading campaigns...</div>;
    }

    if (!selectedCampaign) {
        return (
            <div style={{ padding: '24px' }}>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>📊 YOUR CAMPAIGNS</h2>

                {campaigns.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        No campaigns yet. Create a campaign to start collecting human responses!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {campaigns.map((campaign) => (
                            <div
                                key={campaign.bidId}
                                onClick={() => handleCampaignClick(campaign)}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid #222',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#00FF41';
                                    e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#222';
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                                            {campaign.question || 'No question'}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '12px' }}>
                                            {campaign.completedResponses} / {campaign.targetResponses} responses
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            color: campaign.status === 'completed' ? '#00FF41' : '#888',
                                            fontSize: '10px',
                                            letterSpacing: '1px',
                                            marginBottom: '4px'
                                        }}>
                                            {campaign.status === 'completed' ? '✅ COMPLETE' : '🔄 ACTIVE'}
                                        </div>
                                        <div style={{ color: '#00FF41', fontSize: '12px', fontFamily: 'monospace' }}>
                                            {Math.round(campaign.progress)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Campaign Detail View
    return (
        <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            {/* Back Button */}
            <button
                onClick={() => {
                    setSelectedCampaign(null);
                    setResponses(null);
                }}
                style={{
                    backgroundColor: 'transparent',
                    color: '#888',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginBottom: '16px'
                }}
            >
                ← Back to Campaigns
            </button>

            {responses ? (
                <>
                    {/* Campaign Header */}
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            {responses.campaign.question}
                        </h3>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                            Campaign ID: {responses.campaign.bidId}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>RESPONSES</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {responses.stats.totalResponses} / {responses.stats.targetResponses}
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>BUDGET SPENT</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                ${responses.stats.budgetSpent}
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>COMPLETION RATE</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {Math.round(responses.stats.completionRate)}%
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>COST PER RESPONSE</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                ${responses.stats.pricePerResponse}
                            </div>
                        </div>
                    </div>

                    {/* Consensus Section */}
                    {responses.responses.consensus && (
                        <div style={{ backgroundColor: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                            <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>💡 CONSENSUS ANSWER</div>
                            <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                                "{responses.responses.consensus.answer}"
                            </div>
                            <div style={{ color: '#00FF41', fontSize: '12px' }}>
                                {Math.round(responses.responses.consensus.percentage)}% agreement ({responses.responses.consensus.count} responses)
                            </div>
                        </div>
                    )}

                    {/* Response Aggregation */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>📊 RESPONSE BREAKDOWN</h4>
                            <button
                                onClick={exportToCSV}
                                style={{
                                    backgroundColor: '#00FF41',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                📥 EXPORT CSV
                            </button>
                        </div>

                        {responses.responses.aggregated.map((item: any, index: number) => {
                            const percentage = (item.count / responses.stats.totalResponses) * 100;
                            return (
                                <div key={index} style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <div style={{ color: 'white', fontSize: '13px' }}>"{item.answer}"</div>
                                        <div style={{ color: '#00FF41', fontSize: '12px', fontFamily: 'monospace' }}>
                                            {item.count} ({Math.round(percentage)}%)
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: '#222', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${percentage}%`,
                                                height: '100%',
                                                backgroundColor: '#00FF41',
                                                transition: 'width 0.3s'
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Raw Responses */}
                    <div>
                        <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>📝 RAW RESPONSES ({responses.responses.raw.length})</h4>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #222', borderRadius: '6px', padding: '12px' }}>
                            {responses.responses.raw.map((answer: string, index: number) => (
                                <div key={index} style={{ color: '#888', fontSize: '12px', padding: '4px 0', borderBottom: index < responses.responses.raw.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                                    {index + 1}. "{answer}"
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading campaign data...</div>
            )}
        </div>
    );
};
