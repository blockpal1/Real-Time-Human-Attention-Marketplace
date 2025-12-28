import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LoginButton } from './LoginButton';
import { EarningsDashboard } from './EarningsDashboard';
import { useClaim } from '../hooks/useClaim';
import { api } from '../services/api';

interface HeaderProps {
    setView?: (view: 'agent' | 'human') => void;
    theme: 'quantum' | 'classic';
    setTheme: (t: 'quantum' | 'classic') => void;
    userPubkey?: string | null; // Accept null to match App state
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, userPubkey }) => {
    const { authenticated, user, logout } = usePrivy();
    const { wallets } = useWallets();
    const [showEarnings, setShowEarnings] = useState(false);
    const [showEarningsDropdown, setShowEarningsDropdown] = useState(false);
    const [showSignalDropdown, setShowSignalDropdown] = useState(false);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [pendingEarnings, setPendingEarnings] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [signalQuality, setSignalQuality] = useState<number | null>(null);
    const [qualityStatus, setQualityStatus] = useState<'high' | 'medium' | 'low' | 'banned' | 'new'>('new');
    const [seasonPoints, setSeasonPoints] = useState(0);

    // Get wallet address from Privy
    const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
    const walletAddress = embeddedWallet?.address || user?.wallet?.address;

    // Claim hook for USDC withdrawals
    const { claiming, claimEarnings } = useClaim(walletAddress || '');

    // Listen for refresh event from match completion
    useEffect(() => {
        const handleRefresh = () => {
            if (walletAddress) {
                loadEarnings();
                loadSignalQuality();
                loadSeasonPoints();
            }
        };
        window.addEventListener('refresh-user-stats', handleRefresh);
        return () => window.removeEventListener('refresh-user-stats', handleRefresh);
    }, [walletAddress]);

    // Fetch earnings, signal quality, and season points on mount and when wallet address changes
    useEffect(() => {
        if (walletAddress) {
            loadEarnings();
            loadSignalQuality();
            loadSeasonPoints();
        }
    }, [walletAddress]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showEarningsDropdown && !target.closest('.earnings-dropdown-container')) {
                setShowEarningsDropdown(false);
            }
            if (showSignalDropdown && !target.closest('.signal-dropdown-container')) {
                setShowSignalDropdown(false);
            }
            if (showUserDropdown && !target.closest('.user-dropdown-container')) {
                setShowUserDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEarningsDropdown, showSignalDropdown, showUserDropdown]);

    const loadEarnings = async () => {
        if (!walletAddress) return;
        try {
            const data = await api.getUserEarnings(walletAddress);
            setTotalEarnings(data.allTime || 0);

            // Fetch balance data
            const balanceData = await api.getUserBalance(walletAddress);
            setPendingEarnings(balanceData.pending || 0);
            setWalletBalance(balanceData.wallet || 0);
        } catch (error) {
            console.error('Failed to load earnings:', error);
        }
    };

    const loadSignalQuality = async () => {
        if (!walletAddress) return;
        try {
            const data = await api.getSignalQuality(walletAddress);
            setSignalQuality(data.quality);
            setQualityStatus(data.status);
        } catch (error) {
            console.error('Failed to load signal quality:', error);
            // Set default values on error
            setSignalQuality(50);
            setQualityStatus('new');
        }
    };

    const loadSeasonPoints = async () => {
        if (!walletAddress) return;
        try {
            const points = await api.getSeasonPoints(walletAddress);
            setSeasonPoints(points);
        } catch (error) {
            console.error('Failed to load season points:', error);
            setSeasonPoints(0);
        }
    };

    return (
        <>
            <header className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-neon)] bg-[var(--bg-glass)] backdrop-blur-md z-50 shadow-[var(--shadow-neon)] transition-all duration-500">
                {/* Logo */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = '#landing'}>
                    <div className="w-2 h-2 rounded-full bg-[#0EA5E9] shadow-[0_0_10px_#0EA5E9] animate-pulse"></div>
                    <h1 className="text-xl font-bold text-white tracking-widest uppercase">
                        Attentium <span className="text-xs text-[#0EA5E9] font-mono align-top ml-1">BETA</span>
                    </h1>
                </div>

                {/* Right Side: Stats & Wallet */}
                <div className="flex items-center gap-6">

                    {/* Theme Toggle */}
                    <button
                        onClick={() => setTheme(theme === 'quantum' ? 'classic' : 'quantum')}
                        className="p-2 rounded-full hover:bg-white/5 border border-transparent hover:border-[var(--border-neon)] transition-all"
                        title="Toggle Quantum Theme"
                    >
                        {theme === 'quantum' ? '🔮' : '🌑'}
                    </button>

                    {/* Earnings Dropdown */}
                    {walletAddress && (
                        <div className="relative earnings-dropdown-container">
                            <button
                                onClick={() => setShowEarningsDropdown(!showEarningsDropdown)}
                                className="flex items-center gap-2 px-3 py-1 rounded-full border border-[#0EA5E9]/50 hover:border-[#0EA5E9] transition-all text-xs"
                                style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)' }}
                                title="View Earnings Breakdown"
                            >
                                <span className="text-gray-400">💰</span>
                                <span className="text-[#0EA5E9] font-mono font-bold">${pendingEarnings.toFixed(4)}</span>
                            </button>

                            {/* Dropdown */}
                            {showEarningsDropdown && (
                                <div
                                    className="absolute right-0 mt-2 w-72 bg-[#0a0a0a] border border-white/20 rounded-lg shadow-lg z-50"
                                    style={{ top: '100%' }}
                                >
                                    <div className="p-4">
                                        <div className="text-white font-bold text-sm mb-3 border-b border-white/10 pb-2">
                                            Earnings Breakdown
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-xs">Pending:</span>
                                                <span className="text-[#0088FF] font-mono font-bold">
                                                    ${pendingEarnings.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 -mt-2 text-right">
                                                (Ready to claim)
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-xs">Wallet:</span>
                                                <span className="text-white font-mono font-bold">
                                                    ${walletBalance.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 -mt-2 text-right">
                                                (Funds you control)
                                            </div>

                                            <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                                <span className="text-gray-400 text-xs">Lifetime:</span>
                                                <span className="text-white font-mono font-bold">
                                                    ${totalEarnings.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 -mt-2 text-right">
                                                (Total Earned)
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => claimEarnings(() => loadEarnings())}
                                            disabled={claiming || pendingEarnings === 0}
                                            className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${claiming || pendingEarnings === 0
                                                ? 'bg-[#0088FF]/20 text-[#0088FF] opacity-50 cursor-not-allowed'
                                                : 'bg-[#0088FF] text-white hover:bg-[#0066CC] cursor-pointer'
                                                }`}
                                        >
                                            {claiming ? 'Claiming...' : 'Claim to Wallet'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signal Quality Dropdown */}
                    {walletAddress && signalQuality !== null && (
                        <div className="relative signal-dropdown-container">
                            <button
                                onClick={() => setShowSignalDropdown(!showSignalDropdown)}
                                className="flex items-center gap-2 px-3 py-1 rounded-full border transition-all text-xs cursor-pointer"
                                style={{
                                    borderColor: qualityStatus === 'high' ? 'rgba(0, 136, 255, 0.5)' :
                                        qualityStatus === 'medium' ? 'rgba(255, 184, 0, 0.5)' :
                                            qualityStatus === 'low' ? 'rgba(255, 136, 0, 0.5)' :
                                                qualityStatus === 'banned' ? 'rgba(255, 68, 68, 0.5)' : 'rgba(102, 102, 102, 0.5)',
                                    backgroundColor: qualityStatus === 'high' ? 'rgba(0, 136, 255, 0.1)' :
                                        qualityStatus === 'medium' ? 'rgba(255, 184, 0, 0.1)' :
                                            qualityStatus === 'low' ? 'rgba(255, 136, 0, 0.1)' :
                                                qualityStatus === 'banned' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(102, 102, 102, 0.1)'
                                }}
                                title="Signal Quality Score - Click for details"
                            >
                                <span className="text-gray-400">⚡ SIGNAL</span>
                                <span
                                    className="font-mono font-bold"
                                    style={{
                                        color: qualityStatus === 'high' ? '#0088FF' :
                                            qualityStatus === 'medium' ? '#FFB800' :
                                                qualityStatus === 'low' ? '#FF8800' :
                                                    qualityStatus === 'banned' ? '#FF4444' : '#888'
                                    }}
                                >
                                    {signalQuality}
                                </span>
                            </button>

                            {/* Dropdown */}
                            {showSignalDropdown && (
                                <div
                                    className="absolute right-0 mt-2 w-80 bg-[#0a0a0a] border border-white/20 rounded-lg shadow-lg z-50"
                                    style={{ top: '100%' }}
                                >
                                    <div className="p-4">
                                        {/* Section A: The Visual (Status) */}
                                        <div className="mb-4">
                                            <div className="text-white font-bold text-sm mb-2">
                                                Current Quality
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className="font-mono font-bold text-2xl"
                                                    style={{
                                                        color: qualityStatus === 'high' ? '#0088FF' :
                                                            qualityStatus === 'medium' ? '#FFB800' :
                                                                qualityStatus === 'low' ? '#FF8800' :
                                                                    qualityStatus === 'banned' ? '#FF4444' : '#888'
                                                    }}
                                                >
                                                    {signalQuality}
                                                </span>
                                                <span className="text-gray-400 text-sm">/ 100</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className="h-full transition-all duration-300"
                                                    style={{
                                                        width: `${signalQuality}%`,
                                                        backgroundColor: qualityStatus === 'high' ? '#0088FF' :
                                                            qualityStatus === 'medium' ? '#FFB800' :
                                                                qualityStatus === 'low' ? '#FF8800' :
                                                                    qualityStatus === 'banned' ? '#FF4444' : '#888'
                                                    }}
                                                />
                                            </div>

                                            {/* Status Label */}
                                            <div
                                                className="text-xs font-bold"
                                                style={{
                                                    color: qualityStatus === 'high' ? '#0088FF' :
                                                        qualityStatus === 'medium' ? '#FFB800' :
                                                            qualityStatus === 'low' ? '#FF8800' :
                                                                qualityStatus === 'banned' ? '#FF4444' : '#888'
                                                }}
                                            >
                                                {qualityStatus === 'high' ? '✅ Excellent' :
                                                    qualityStatus === 'medium' ? '⚠️ Good' :
                                                        qualityStatus === 'low' ? '⚠️ At Risk' :
                                                            qualityStatus === 'banned' ? '🚫 Suspended' : '⚪ New'}
                                            </div>
                                        </div>

                                        {/* Section B: The Rules (Educational) */}
                                        <div className="mb-4 pb-4 border-b border-white/10">
                                            <div className="text-white font-bold text-xs mb-2">
                                                How to improve:
                                            </div>
                                            <div className="space-y-2 text-xs text-gray-400">
                                                <div className="flex gap-2">
                                                    <span>✅</span>
                                                    <span><strong className="text-white">Accuracy:</strong> Consistent, relevant answers increase your score.</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span>❌</span>
                                                    <span><strong className="text-white">Spam:</strong> Gibberish or irrelevant answers carry a heavy penalty.</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span>📉</span>
                                                    <span><strong className="text-white">Consistency:</strong> Inactivity slowly lowers your score. Stay active to maintain your reputation.</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section C: The Stakes (The "Why") */}
                                        <div className="space-y-2 text-xs">
                                            <div className="text-red-400">
                                                ⚠️ Scores below 20 result in account suspension.
                                            </div>
                                            <div className="text-[#0088FF]">
                                                ✨ Higher scores unlock exclusive opportunities.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Season Points Pill */}
                    {walletAddress && (
                        <div
                            className="flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/50 text-xs"
                            style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}
                            title="Season Zero Points - Earned from $0 campaigns"
                        >
                            <span className="text-gray-400">🎮</span>
                            <span className="text-purple-400 font-mono font-bold">{seasonPoints.toLocaleString()} pts</span>
                        </div>
                    )}

                    {/* User Account Dropdown */}
                    {authenticated && user ? (
                        <div className="relative user-dropdown-container">
                            <button
                                onClick={() => setShowUserDropdown(!showUserDropdown)}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/30 hover:border-white/50 text-xs text-white font-mono transition-all cursor-pointer"
                            >
                                {user.email ? user.email.address : 'User'}
                            </button>

                            {/* Dropdown */}
                            {showUserDropdown && (
                                <div
                                    className="absolute right-0 mt-2 w-72 bg-[#0a0a0a] border border-white/20 rounded-lg shadow-lg z-50"
                                    style={{ top: '100%' }}
                                >
                                    <div className="p-4">
                                        <div className="text-white font-bold text-sm mb-3 border-b border-white/10 pb-2">
                                            Account
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            {/* Email */}
                                            <div>
                                                <div className="text-gray-400 text-xs mb-1">Email</div>
                                                <div className="text-white text-sm font-mono">
                                                    {user.email?.address || user.google?.email || user.twitter?.username || 'Not available'}
                                                </div>
                                            </div>
                                            {/* Wallet Address */}
                                            {walletAddress && (
                                                <div>
                                                    <div className="text-gray-400 text-xs mb-1">Wallet Address</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-white text-xs font-mono flex-1 truncate">
                                                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(walletAddress);
                                                            }}
                                                            className="text-[#0088FF] hover:text-white text-xs transition-colors"
                                                            title="Copy wallet address"
                                                        >
                                                            📋
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                logout();
                                                setShowUserDropdown(false);
                                            }}
                                            className="w-full py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            )}
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
