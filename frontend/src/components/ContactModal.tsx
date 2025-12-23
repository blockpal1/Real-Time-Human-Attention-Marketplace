import React, { useState, useEffect } from 'react';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
    const [connectionStatus, setConnectionStatus] = useState(0); // 0: Connect, 1: Connected
    const [copied, setCopied] = useState(false);

    // Connection Animation Sequence
    useEffect(() => {
        if (isOpen) {
            setConnectionStatus(0);
            const timer = setTimeout(() => setConnectionStatus(1), 1500); // 1.5s artificial delay
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText('support@attentium.ai');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* HUD Container */}
            <div className="relative z-10 w-full max-w-xl bg-[#0F111A] border-2 border-[#0EA5E9] shadow-[0_0_30px_rgba(14,165,233,0.2)] overflow-hidden">

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#0EA5E9]" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#0EA5E9]" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#0EA5E9]" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#0EA5E9]" />

                {/* Scanline Overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[len:100%_4px,3px_100%] opacity-20" />

                {/* Content */}
                <div className="p-8 font-mono text-[#0EA5E9] relative z-30">

                    {/* Header */}
                    <div className="mb-8 border-b border-[#0EA5E9]/30 pb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs uppercase tracking-widest text-gray-500">Uplink Protocol v9.2</span>
                            <span className="flex gap-1">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse delay-75" />
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-150" />
                            </span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">
                            {connectionStatus === 0 ? (
                                <span className="animate-pulse">ESTABLISHING_CONNECTION...</span>
                            ) : (
                                "UPLINK ESTABLISHED"
                            )}
                        </h2>
                    </div>

                    {/* Status Bar */}
                    <div className="bg-[#0EA5E9]/10 p-2 mb-8 text-xs flex justify-between uppercase">
                        <span>Encryption: <span className="text-white">ENABLED</span></span>
                        <span>Signal: <span className="text-green-400">STRONG</span></span>
                    </div>

                    {/* Main Interaction (Only show when connected) */}
                    {connectionStatus === 1 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-2 text-xs text-gray-400 uppercase">Direct Line [EMAIL]</div>
                            <div className="flex flex-col sm:flex-row gap-4 items-center mb-8">
                                <div className="bg-black border border-[#0EA5E9]/50 p-4 w-full text-center sm:text-left text-white font-bold text-lg">
                                    support@attentium.ai
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className={`w-full sm:w-auto px-6 py-4 border-2 font-bold transition-all duration-200 uppercase whitespace-nowrap
                                        ${copied
                                            ? 'bg-green-500 border-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                                            : 'border-[#0EA5E9] hover:bg-[#0EA5E9] hover:text-black text-[#0EA5E9] shadow-[0_0_10px_rgba(14,165,233,0.3)]'
                                        }`}
                                >
                                    {copied ? 'COPIED!' : '[ COPY_ADDRESS ]'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-[#0EA5E9]/30 pt-6 flex justify-between items-end">
                        <div className="text-xs text-gray-500 max-w-[150px]">
                            Transmission logic initialized. Secure channel active.
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 text-sm transition-colors hover:text-red-300"
                        >
                            [ EXIT_UPLINK ]
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
