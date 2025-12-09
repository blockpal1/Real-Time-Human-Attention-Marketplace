import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from './LoginButton';

interface HeaderProps {
    setView?: (view: 'agent' | 'human') => void;
    theme: 'quantum' | 'classic';
    setTheme: (t: 'quantum' | 'classic') => void;
}

export const Header: React.FC<HeaderProps> = ({ setView, theme, setTheme }) => {
    const { authenticated, user, logout } = usePrivy();

    return (
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

                {/* Theme Toggle (Restored) */}
                <button
                    onClick={() => setTheme(theme === 'quantum' ? 'classic' : 'quantum')}
                    className="p-2 rounded-full hover:bg-white/5 border border-transparent hover:border-[var(--border-neon)] transition-all"
                    title="Toggle Quantum Theme"
                >
                    {theme === 'quantum' ? '🔮' : '🌑'}
                </button>

                {/* Focus Mode Button - REMOVED: Focus experience now handled by match modal */}

                {/* Balance Pill - HIDDEN FOR WEB 2.5 (Focus on USDC in Portal) */}
                {/* <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-gray-400">
                    <span>BALANCE</span>
                    <span className="text-white font-mono font-bold">$0.00</span>
                </div> */}

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
    );
};
