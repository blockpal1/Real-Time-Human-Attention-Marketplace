import React, { useState } from 'react';
import { api } from '../services/api';

interface PriceFloorSetterProps {
    duration: number;
    setDuration: (d: number) => void;
    setSessionToken: (token: string | null) => void;
    setUserPubkey: (pubkey: string | null) => void;
    sessionToken: string | null;
}

export const PriceFloorSetter: React.FC<PriceFloorSetterProps> = ({
    duration,
    setDuration,
    setSessionToken,
    setUserPubkey,
    sessionToken
}) => {
    const [price, setPrice] = useState(0.0001);
    const [loading, setLoading] = useState(false);

    const hasActiveSession = !!sessionToken;
    const pubkey = 'test-user-consistent'; // Mock pubkey for demo

    const handlePlaceAsk = async () => {
        setLoading(true);
        try {
            const data = await api.startSession(pubkey, Math.floor(price * 1_000_000));
            if (data.session_token) {
                setSessionToken(data.session_token);
                setUserPubkey(pubkey);
                if (data.existing) {
                    alert("You already have an active ask!");
                } else {
                    alert("Ask Posted to Order Book!");
                }
            }
        } catch (e) {
            console.error(e);
            alert('Failed to post ask');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelAsk = async () => {
        setLoading(true);
        try {
            await api.cancelSession(pubkey);
            setSessionToken(null);
            setUserPubkey(null);
            alert("Ask Cancelled!");
        } catch (e) {
            console.error(e);
            alert('Failed to cancel ask');
        } finally {
            setLoading(false);
        }
    };

    const handleButtonClick = () => {
        if (hasActiveSession) {
            handleCancelAsk();
        } else {
            handlePlaceAsk();
        }
    };

    const handleAcceptHighest = async () => {
        setLoading(true);
        try {
            const data = await api.acceptHighestBid(pubkey, duration);
            if (data.success) {
                // Set user state so dismiss can properly cancel the session
                setUserPubkey(pubkey);
                setSessionToken(`accept-highest-${Date.now()}`); // Mark as active
                // Match is found! The WebSocket will trigger the modal via MATCH_FOUND event
                console.log('Matched with bid:', data.match);
            }
        } catch (e: any) {
            console.error(e);
            alert(e.message || 'No bids available');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Ask Settings Header */}
            <div className="glass-panel p-4 rounded flex flex-col gap-4">
                <div className="text-secondary text-xs uppercase tracking-wide font-bold border-b border-gray-800 pb-2 mb-2">Ask Settings</div>

                {/* Duration Selector */}
                <div>
                    <label className="block text-secondary text-[10px] uppercase mb-1">Select Order Book (Duration)</label>
                    <div className="flex gap-2">
                        {[10, 30, 60].map(s => (
                            <button
                                key={s}
                                onClick={() => setDuration(s)}
                                disabled={hasActiveSession}
                                className={`flex-1 py-2 text-xs border rounded transition-all font-mono ${duration === s
                                    ? 'border-white/50 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                                    } ${hasActiveSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {s}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ask Price Input */}
                <div>
                    <label className="block text-secondary text-[10px] uppercase mb-1">
                        Ask Price <span className="text-white/40">(USDC/s)</span>
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            value={price}
                            disabled={hasActiveSession}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className={`w-full bg-dark border border-gray-700 rounded p-2 text-sm text-center font-mono text-white transition-colors focus:border-white/50 ${hasActiveSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                </div>
            </div>

            {/* Submit / Cancel Button */}
            <button
                onClick={handleButtonClick}
                disabled={loading}
                className={`w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-all
                    ${loading
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : hasActiveSession
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]'
                            : 'bg-white hover:bg-gray-200 text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]'
                    }`}
            >
                {loading ? 'Processing...' : hasActiveSession ? 'Cancel Ask' : 'Place Ask'}
            </button>

            {/* Accept Highest Bid Button */}
            <button
                onClick={handleAcceptHighest}
                disabled={loading || hasActiveSession}
                className={`w-full py-2 rounded border text-xs transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed
                    ${hasActiveSession
                        ? 'border-gray-700 text-gray-500'
                        : 'border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#0EA5E9]/10 hover:text-white'
                    }`}
            >
                {loading ? 'Matching...' : 'Accept Highest Bid'}
            </button>
        </div>
    );
};
