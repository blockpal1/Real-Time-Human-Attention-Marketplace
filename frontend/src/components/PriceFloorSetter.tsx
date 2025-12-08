import React, { useState } from 'react';
import { api } from '../services/api';

interface PriceFloorSetterProps {
    duration: number;
    setDuration: (d: number) => void;
    setSessionToken: (token: string) => void;
}

export const PriceFloorSetter: React.FC<PriceFloorSetterProps> = ({ duration, setDuration, setSessionToken }) => {
    const [price, setPrice] = useState(0.0001); // USDC per second (matching Bid side)
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Mock pubkey for demo
            const pubkey = 'test-user-consistent';
            const data = await api.startSession(pubkey, Math.floor(price * 1_000_000));
            if (data.session_token) {
                setSessionToken(data.session_token);
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
                                    ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(0,255,65,0.2)]'
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
                        Ask Price <span className="text-cyan-900">(USDC/s)</span>
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-sm text-center font-mono text-cyan-400 transition-colors focus:border-cyan-500"
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
                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,170,255,0.3)] hover:shadow-[0_0_30px_rgba(0,170,255,0.5)]'
                    }`}
            >
                {loading ? 'Posting...' : 'Place Ask'}
            </button>

            {/* Accept Highest Bid Button */}
            <button
                onClick={() => alert('Feature coming soon: Auto-match with best bid')}
                className="w-full py-2 rounded border border-gray-700 text-gray-400 text-xs hover:border-green-500 hover:text-green-400 transition-colors uppercase tracking-widest"
            >
                Accept Highest Bid
            </button>
        </div>
    );
};
