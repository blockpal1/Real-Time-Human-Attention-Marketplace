import React, { useEffect, useState } from 'react';

interface MatchNotificationModalProps {
    match: {
        matchId: string;
        price: number;
        duration: number;
        topic?: string | object; // Handle potential object safely
    };
    onAccept: () => void;
    onDismiss: () => void;
}

export const MatchNotificationModal: React.FC<MatchNotificationModalProps> = ({ match, onAccept, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    // Safety check for topic
    const topicDisplay = typeof match.topic === 'string' ? match.topic : 'New Match';

    useEffect(() => {
        setVisible(true);
    }, []);

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onDismiss} />

            {/* Modal Card */}
            <div className="relative bg-[#09090b] w-full max-w-md p-1 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,255,65,0.3)] border border-white/10 transform transition-all duration-300 scale-100">

                {/* Animated Border Gradient / Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-transparent to-black opacity-50 pointer-events-none" />

                {/* Content Container */}
                <div className="relative bg-[#09090b]/90 p-8 rounded-xl backdrop-blur-xl flex flex-col items-center text-center">

                    {/* Icon / Status */}
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,255,65,0.2)] animate-pulse">
                        <span className="text-3xl">⚡</span>
                    </div>

                    <div className="text-green-500 font-mono text-xs font-bold tracking-[0.2em] mb-2 uppercase">
                        Match Detected
                    </div>

                    <h2 className="text-2xl text-white font-bold mb-8 leading-tight">
                        {topicDisplay}
                    </h2>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full mb-8">
                        <div className="bg-white/5 border border-white/5 p-4 rounded-lg flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rate</span>
                            <span className="text-xl font-mono text-green-400">
                                ${match.price.toFixed(4)}<span className="text-xs text-gray-600">/s</span>
                            </span>
                        </div>
                        <div className="bg-white/5 border border-white/5 p-4 rounded-lg flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Duration</span>
                            <span className="text-xl font-mono text-white">
                                {match.duration}s
                            </span>
                        </div>
                    </div>

                    {/* Est. Earnings Highlight */}
                    <div className="w-full bg-green-500/5 border border-green-500/20 p-4 rounded-lg mb-8 flex justify-between items-center px-6">
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Est. Earnings</span>
                        <span className="text-2xl font-mono font-bold text-green-400 text-shadow-glow">
                            ${(match.price * match.duration).toFixed(4)}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="w-full flex flex-col gap-3">
                        <button
                            onClick={onAccept}
                            className="w-full bg-[#00FF41] hover:bg-[#00cc33] text-black font-bold py-4 rounded-lg uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,255,65,0.4)] hover:shadow-[0_0_40px_rgba(0,255,65,0.6)] hover:scale-[1.02]"
                        >
                            Accept & Focus
                        </button>
                        <button
                            onClick={onDismiss}
                            className="w-full bg-transparent hover:bg-white/5 text-gray-500 hover:text-white font-mono text-xs py-3 rounded-lg transition-colors border border-transparent hover:border-white/10"
                        >
                            Dismiss Offer
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
