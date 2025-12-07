import React, { useState } from 'react';

interface HeaderProps {
    setView?: (view: 'agent' | 'human') => void;
}

export const Header: React.FC<HeaderProps> = ({ setView }) => {
    const [wallet, setWallet] = useState<string | null>(null);

    const connectWallet = async () => {
        if ('solana' in window) {
            const resp = await (window as any).solana.connect();
            setWallet(resp.publicKey.toString());
        }
    };

    return (
        <header className="flex justify-between items-center px-6 py-4 border-b border-[#333842] bg-[#0a0e27]/90 backdrop-blur z-50">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView && setView('agent')}>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#00FF41] animate-pulse"></div>
                <h1 className="text-xl font-bold text-white tracking-widest uppercase">
                    Attentium <span className="text-xs text-green-500 font-mono align-top ml-1">BETA</span>
                </h1>
            </div>

            {/* Right Side: Stats & Wallet */}
            <div className="flex items-center gap-6">

                {/* Focus Mode Button */}
                {setView && (
                    <button
                        onClick={() => setView('human')}
                        className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors border border-gray-700 px-3 py-1 rounded hover:border-gray-500"
                    >
                        Enter Focus Portal
                    </button>
                )}

                {/* Balance Pill */}
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-gray-400">
                    <span>BALANCE</span>
                    <span className="text-white font-mono font-bold">$0.00</span>
                </div>

                {/* Connect Button */}
                <button
                    onClick={connectWallet}
                    className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all border
                        ${wallet
                            ? 'bg-green-500/10 border-green-500 text-green-400 cursor-default'
                            : 'bg-purple-600 border-purple-500 text-white hover:bg-purple-500 hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                        }`}
                >
                    {wallet ? `Connected: ${wallet.slice(0, 4)}...${wallet.slice(-4)}` : 'Connect Wallet'}
                </button>
            </div>
        </header>
    );
};
