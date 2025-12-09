import React, { useState } from 'react';
import { api } from '../services/api';

interface PlaceBidProps {
    duration: number;
    setDuration: (d: number) => void;
}

export const PlaceBid: React.FC<PlaceBidProps> = ({ duration, setDuration }) => {
    // Campaign Logic
    const [price, setPrice] = useState(0.0001); // USDC per second
    const [targetUsers, setTargetUsers] = useState(100);
    const [question, setQuestion] = useState('');
    const [contentUrl, setContentUrl] = useState('');
    const [loading, setLoading] = useState(false);

    // Derived
    const totalSeconds = targetUsers * duration;
    const totalEscrowUSDC = price * totalSeconds;

    const handleSubmit = async () => {
        // Validate required fields
        if (!question.trim()) {
            alert('Validation Question is required!');
            return;
        }

        setLoading(true);
        try {
            await api.submitBid({
                max_price_per_second: Math.floor(price * 1_000_000),
                quantity_seconds: totalSeconds,
                required_attention_score: 0.5,
                category: 'meme',
                content_url: contentUrl || undefined,
                target_url: 'https://example.com/ad',
                duration_per_user: duration,
                target_quantity: targetUsers,
                validation_question: question,
            });
            console.log("Bid Submitted Successfully");
            alert('Bid Placed Successfully!');
            // Reset form
            setContentUrl('');
            setQuestion('');
        } catch (e) {
            console.error(e);
            alert('Failed to submit bid');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">

            {/* 1. Creative Asset (Image URL for now) */}
            <div className="glass-panel p-4 rounded">
                <div className="text-secondary text-xs uppercase tracking-wide mb-2 font-bold">1. Creative Asset URL</div>
                <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-3 text-sm focus:border-green-500 transition-colors text-white placeholder-gray-600"
                />
                <div className="text-[10px] text-gray-600 mt-1">Paste an image URL (supports jpg, png, gif)</div>
            </div>

            {/* 2. Validation */}
            <div className="glass-panel p-4 rounded">
                <div className="text-secondary text-xs uppercase tracking-wide mb-2 font-bold">
                    2. Validation Question <span className="text-red-500">*</span>
                </div>
                <input
                    type="text"
                    placeholder="e.g. Did you see the logo?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    className="w-full bg-dark border border-gray-700 rounded p-3 text-sm focus:border-green-500 transition-colors text-white placeholder-gray-600"
                />
                <div className="text-[10px] text-gray-600 mt-1">This question will be shown to humans after viewing your content</div>
            </div>

            {/* 3. Targeting & Budget - Stack Layout (Fixed Overflow) */}
            <div className="glass-panel p-4 rounded flex flex-col gap-4">
                <div className="text-secondary text-xs uppercase tracking-wide font-bold border-b border-gray-800 pb-2 mb-2">3. Campaign Parameters</div>

                {/* Duration Bucket */}
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

                <div className="grid grid-cols-1 gap-4">
                    {/* Target Users */}
                    <div>
                        <label className="block text-secondary text-[10px] uppercase mb-1">
                            Order Size <span className="text-gray-600">(Target Humans)</span>
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                min="1"
                                value={targetUsers}
                                onChange={(e) => setTargetUsers(Math.max(1, Number(e.target.value)))}
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-sm text-center font-mono text-white transition-colors focus:border-green-500"
                            />
                        </div>
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-secondary text-[10px] uppercase mb-1">
                            Bid Price <span className="text-green-900">(USDC/s)</span>
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                value={price}
                                onChange={(e) => setPrice(Number(e.target.value))}
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-sm text-center font-mono text-green-400 transition-colors focus:border-green-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Cost Summary & Action */}
            <div className="p-4 bg-green-900/5 border border-green-500/20 rounded text-center">
                <div className="flex justify-between items-center mb-2 px-2">
                    <span className="text-xs text-gray-500">Total Attention</span>
                    <span className="text-xs text-white font-mono">{targetUsers * duration}s</span>
                </div>
                <div className="flex justify-between items-center mb-4 px-2 border-b border-green-500/20 pb-2">
                    <span className="text-xs text-gray-500">Est. Cost</span>
                    <span className="text-xl font-bold text-green-400 font-mono text-shadow-neon">
                        ${totalEscrowUSDC.toFixed(4)}
                    </span>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-all
                        ${loading
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]'
                        }`}
                >
                    {loading ? 'Processing...' : 'Place Bid'}
                </button>

                <button
                    onClick={() => window.location.hash = '#analytics'}
                    className="w-full py-2 mt-2 rounded font-bold uppercase tracking-wider text-xs transition-all bg-transparent border border-green-500/30 text-green-500 hover:bg-green-500/10"
                >
                    📊 VIEW CAMPAIGN ANALYTICS
                </button>
            </div>
        </div>
    );
};
