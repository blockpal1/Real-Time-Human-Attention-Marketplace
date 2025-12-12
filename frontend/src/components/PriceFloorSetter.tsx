import React, { useState } from 'react';
import { api } from '../services/api';

interface PriceFloorSetterProps {
    duration: number;
    setDuration: (d: number) => void;
    setSessionToken: (token: string) => void;
    setUserPubkey: (pubkey: string) => void;
}

export const PriceFloorSetter: React.FC<PriceFloorSetterProps> = ({ duration, setDuration, setSessionToken, setUserPubkey }) => {
    const [price, setPrice] = useState(0.0001);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Mock pubkey for demo
            const pubkey = 'test-user-consistent';
            const data = await api.startSession(pubkey, Math.floor(price * 1_000_000));
            if (data.session_token) {
                setSessionToken(data.session_token);
                setUserPubkey(pubkey); // Store pubkey for earnings tracking
                alert("Ask Posted to Order Book!");
            }
        } catch (e) {
            console.error(e);
            alert('Failed to post ask');
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
                                className={`flex-1 py-2 text-xs border rounded transition-all font-mono ${duration === s
                                    ? 'border-white/50 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                                    }`}
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
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-sm text-center font-mono text-white transition-colors focus:border-white/50"
                        />
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-all
                    ${loading
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-white hover:bg-gray-200 text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]'
                    }`}
            >
                {loading ? 'Posting...' : 'Place Ask'}
            </button>

            {/* Accept Highest Bid Button */}
            <button
                onClick={() => alert('Feature coming soon: Auto-match with best bid')}
                className="w-full py-2 rounded border border-gray-700 text-gray-400 text-xs hover:border-white/50 hover:text-white transition-colors uppercase tracking-widest"
            >
                Accept Highest Bid
            </button>
        </div>
    );
};
