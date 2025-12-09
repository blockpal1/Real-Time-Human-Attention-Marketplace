import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from './LoginButton';
import { EarningsDashboard } from './EarningsDashboard';
import { api } from '../services/api';

interface HeaderProps {
    setView?: (view: 'agent' | 'human') => void;
    theme: 'quantum' | 'classic';
    setTheme: (t: 'quantum' | 'classic') => void;
    userPubkey?: string | null; // Accept null to match App state
}

export const Header: React.FC<HeaderProps> = ({ setView, theme, setTheme, userPubkey }) => {
    const { authenticated, user, logout } = usePrivy();
    const [showEarnings, setShowEarnings] = useState(false);
    const [totalEarnings, setTotalEarnings] = useState(0);

    // Fetch earnings summary on mount and when userPubkey changes
    useEffect(() => {
        if (userPubkey) {
            loadEarnings();
        }
    }, [userPubkey]);

    const loadEarnings = async () => {
        if (!userPubkey) return;
        try {
            const data = await api.getUserEarnings(userPubkey);
            setTotalEarnings(data.allTime || 0);
        } catch (error) {
            console.error('Failed to load earnings:', error);
        }
    };

    return (
        <>
            <header className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-neon)] bg-[var(--bg-glass)] backdrop-blur-md z-50 shadow-[var(--shadow-neon)] transition-all duration-500">
                {/* Logo */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView && setView('agent')}>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#00FF41] animate-pulse"></div>
                    <h1 className="text-xl font-bold text-white tracking-widest uppercase">
                        Attentium <span className="text-xs text-green-500 font-mono align-top ml-1">BETA</span>
                    </h1>
                </div>

                {/* Right Side: Stats & Wallet */}
                <div className="flex items-center gap-6">

                    {/* Earnings Pill (if user has pubkey) */}
                    {userPubkey && (
                        <button
                            onClick={() => setShowEarnings(true)}
                            className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/30 hover:border-green-500 transition-all text-xs"
                            title="View Earnings"
                        >
                            <span className="text-gray-400">💰 EARNED</span>
                            <span className="text-green-400 font-mono font-bold">${totalEarnings.toFixed(4)}</span>
                        </button>
                    )}

                    {/* Theme Toggle */}
                    <button
                        onClick={() => setTheme(theme === 'quantum' ? 'classic' : 'quantum')}
                        className="p-2 rounded-full hover:bg-white/5 border border-transparent hover:border-[var(--border-neon)] transition-all"
                        title="Toggle Quantum Theme"
                    >
                        {theme === 'quantum' ? '🔮' : '🌑'}
                    </button>

                    {/* Privy Auth */}
                    {authenticated && user ? (
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500 text-xs text-green-400 font-mono">
                                {user.email ? user.email.address : 'User'}
                            </div>
                            <button
                                onClick={logout}
                                className="text-gray-500 hover:text-white text-xs transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <LoginButton />
                    )}
                </div>
            </header>

            {/* Earnings Dashboard Modal */}
            {userPubkey && (
                <EarningsDashboard
                    userPubkey={userPubkey}
                    isOpen={showEarnings}
                    onClose={() => {
                        setShowEarnings(false);
                        loadEarnings(); // Refresh on close
                    }}
                />
            )}
        </>
    );
};
