import React, { useState, useEffect } from 'react';
import { usePrivy, useConnectWallet } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Home, Megaphone, Hammer, ShieldAlert } from 'lucide-react';
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
    const { connectWallet } = useConnectWallet();
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
    const [activePath, setActivePath] = useState(window.location.hash || '#');

    // Get wallet address from Privy
    const embeddedWallet = wallets.find((wallet) => (wallet as any).walletClientType === 'privy');
    const walletAddress = embeddedWallet?.address || user?.wallet?.address;

    // Claim hook for USDC withdrawals
    const { claiming, claimEarnings, claimState, claimResult, getStatusText: getClaimStatusText, resetClaimState } = useClaim(walletAddress || '');

    // -------------------------------------------------------------------------
    // Connect & Claim Logic
    // -------------------------------------------------------------------------

    // Determine button state and handlers
    const getClaimButtonConfig = () => {
        // Check if we have an embedded wallet in linkedAccounts
        const embeddedAccount = user?.linkedAccounts.find(
            (a) => a.type === 'wallet' &&
                (a as any).walletClientType === 'privy' &&
                (a as any).chainType === 'solana'
        );

        const embeddedAddress = (embeddedAccount as any)?.address;

        // Check if that wallet is in active session
        const sessionWallet = wallets.find(w => w.address === embeddedAddress);

        console.log('[Header] Button Config Debug:', {
            embeddedAddress,
            sessionWalletExists: !!sessionWallet,
            totalWallets: wallets.length,
            walletAddresses: wallets.map(w => w.address),
            linkedAccounts: user?.linkedAccounts?.map(a => ({ type: a.type, clientType: (a as any).walletClientType }))
        });

        if (embeddedAddress && !sessionWallet) {
            // Embedded exists but not connected
            console.log('[Header] Showing "Connect to Claim"');
            return {
                text: 'Connect to Claim',
                handler: handleConnectEmbedded,
                isConnecting: true
            };
        } else {
            // Either external wallet OR embedded wallet already connected
            console.log('[Header] Showing claim status:', getClaimStatusText());
            return {
                text: getClaimStatusText(),
                handler: handleClaim,
                isConnecting: false
            };
        }
    };

    const handleConnectEmbedded = async () => {
        try {
            console.log('[Header] Connecting embedded wallet to session...');
            await connectWallet({
                walletChainType: 'solana-only',
                connectEmbedded: true
            } as any);
            console.log('[Header] Embedded wallet connected. Button should now show "Claim to Wallet"');
        } catch (err) {
            console.error('[Header] Failed to connect embedded wallet:', err);
        }
    };

    const handleClaim = async () => {
        if (claimState === 'confirmed' || claimState === 'failed') {
            resetClaimState();
        }

        console.log('[Header] Initiating claim...');
        claimEarnings(() => loadEarnings());
    };

    // Listen for hash changes to update active path
    useEffect(() => {
        const handleHashChange = () => setActivePath(window.location.hash || '#');
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

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

    const navItems = [
        { label: 'App', icon: Home, path: '#app' },
        { label: 'Campaigns', icon: Megaphone, path: '#campaigns' },
        { label: 'Builders', icon: Hammer, path: '#builders' },
        { label: 'Admin', icon: ShieldAlert, path: '#admin' },
    ];

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

                {/* Central Navigation */}
                <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md absolute left-1/2 transform -translate-x-1/2 shadow-lg shadow-black/50">
                    {navItems.map((item) => {
                        const isActive = activePath === item.path || (item.path === '#' && activePath === '');
                        return (
                            <a
                                key={item.path}
                                href={item.path}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300
                                    ${isActive
                                        ? 'bg-[#0EA5E9] text-white shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }
                                `}
                            >
                                <item.icon size={14} className={isActive ? 'animate-pulse' : ''} />
                                {item.label}
                            </a>
                        );
                    })}
                </nav>

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

                                        {/* Gas Station Status - Only for Embedded Wallet Users */}
                                        {/* Gas Station Status - Only for Embedded Wallet Users */}
                                        {user?.linkedAccounts.some(
                                            (a) => a.type === 'wallet' &&
                                                (a as any).walletClientType === 'privy' &&
                                                (a as any).chainType === 'solana' &&
                                                (a as any).address === walletAddress // CRITICAL: Only match ACTIVE wallet
                                        ) && pendingEarnings > 0 && (
                                                <div className={`mb-4 p-2 rounded-lg text-xs ${pendingEarnings >= 5.0
                                                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                                                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                                                    }`}>
                                                    {pendingEarnings >= 5.0 ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">✓</span>
                                                            <span className="font-semibold">Platform pays gas fees</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-amber-500 font-bold">⚡</span>
                                                                <span className="font-semibold">You pay gas (~0.001 SOL)</span>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 pl-5">
                                                                Earn <span className="text-white font-mono">${(5.0 - pendingEarnings).toFixed(2)}</span> more for free gas
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        {/* Claim Result Toast */}
                                        {claimResult && (
                                            <div className={`mb-3 p-3 rounded-lg text-xs ${claimResult.success
                                                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                                : 'bg-red-500/20 border border-red-500/50 text-red-400'}`}
                                            >
                                                {claimResult.success ? (
                                                    <div>
                                                        <div className="font-bold">✓ Claimed ${claimResult.amount?.toFixed(4)} USDC</div>
                                                        {claimResult.explorerUrl && (
                                                            <a
                                                                href={claimResult.explorerUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-400 hover:underline block mt-1"
                                                            >
                                                                View on Solana Explorer →
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="font-bold">Claim failed</div>
                                                        <div className="text-gray-400 mt-1">{claimResult.error}</div>
                                                        <div className="text-gray-500 mt-1">Your balance is safe. Try again.</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            onClick={() => {
                                                const config = getClaimButtonConfig();
                                                config.handler();
                                            }}
                                            disabled={claiming || (pendingEarnings === 0 && claimState === 'idle')}
                                            className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${claimState === 'confirmed'
                                                ? 'bg-green-500 text-white'
                                                : claimState === 'failed'
                                                    ? 'bg-red-500/80 text-white hover:bg-red-500 cursor-pointer'
                                                    : claiming || pendingEarnings === 0
                                                        ? 'bg-[#0088FF]/20 text-[#0088FF] opacity-50 cursor-not-allowed'
                                                        : 'bg-[#0088FF] text-white hover:bg-[#0066CC] cursor-pointer'
                                                }`}
                                        >
                                            {claiming && (
                                                <span className="inline-block w-3 h-3 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            )}
                                            {getClaimButtonConfig().text}
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
