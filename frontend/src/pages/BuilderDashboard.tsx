import React, { useState, useEffect } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useBuilderBalance } from '../hooks/useBuilderBalance';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const BuilderDashboard: React.FC = () => {
    // Theme state (lifted from App if we prop drill, or local)
    const [theme, setTheme] = useState<'quantum' | 'classic'>('quantum');
    const { wallets } = useWallets();
    const { builderData, loading, error, fetchBalance, claimEarnings, updateWallet } = useBuilderBalance();

    // Local state
    const [code, setCode] = useState('');
    const [newWalletInput, setNewWalletInput] = useState('');
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    // Get active wallet
    const activeWallet = wallets[0]; // Simplification: use first connected wallet

    // Load code from local storage on mount
    useEffect(() => {
        const savedCode = localStorage.getItem('builder_code');
        if (savedCode) {
            setCode(savedCode);
            fetchBalance(savedCode);
        }
    }, [fetchBalance]);

    const handleLoad = () => {
        if (!code) return;
        localStorage.setItem('builder_code', code);
        fetchBalance(code);
    };

    const handleClaim = async () => {
        if (!activeWallet) {
            setStatusMsg("Please connect your wallet first.");
            return;
        }

        // Check if active wallet matches registered wallet
        if (builderData && activeWallet.address !== builderData.wallet) {
            // Warn but allow (maybe they are using a different signer but paying fees?) 
            // Actually, for claim_builder_balance, the wallet MUST sign. 
            // The instruction expects `builder_wallet` to accept SOL (rent back?) or just be signer?
            // In lib.rs:
            // #[account(mut)]
            // public user: Signer<'info>, // Can be anyone paying fees?
            // No, `builder_wallet` is just a destination address?
            // "builder_wallet" is where funds go.
            // "authority" (signer) must match registered wallet?
            // Let's check `claim_builder_balance` in lib.rs.
            // It expects `builder` (PDA) and `builder_wallet` (SystemAccount/TokenAccount?).
            // Actually, usually claims are signed by the owner.
            // Update: We'll assume the connected wallet must be the registered wallet.

            if (activeWallet.address !== builderData.wallet) {
                if (!confirm(`Warning: Your connected wallet (${activeWallet.address.slice(0, 6)}...) does not match the registered builder wallet (${builderData.wallet.slice(0, 6)}...). Transaction may fail if signature is required.`)) {
                    return;
                }
            }
        }

        try {
            setStatusMsg("Preparing claim...");
            const sig = await claimEarnings(code, activeWallet);
            setStatusMsg(`Claim Success! Tx: ${sig}`);
        } catch (e: any) {
            setStatusMsg(`Error: ${e.message}`);
        }
    };

    const handleUpdateWallet = async () => {
        if (!activeWallet || !newWalletInput) return;
        try {
            setStatusMsg("Updating wallet...");
            const sig = await updateWallet(code, activeWallet, newWalletInput);
            setStatusMsg(`Update Success! Tx: ${sig}`);
            setShowUpdateModal(false);
            setNewWalletInput('');
        } catch (e: any) {
            setStatusMsg(`Error: ${e.message}`);
        }
    };

    return (
        <div className={`flex flex-col min-h-screen text-main bg-dark ${theme}`}>
            <Header theme={theme} setTheme={setTheme} userPubkey={activeWallet?.address || null} />

            <main className="flex-1 flex flex-col items-center p-6 pt-12">
                <div className="w-full max-w-2xl bg-panel rounded-xl border border-[var(--border-neon)] p-8 shadow-[var(--shadow-neon)]">
                    <h1 className="text-2xl font-bold mb-6 text-white uppercase tracking-wider text-center">
                        Builder Dashboard
                    </h1>

                    {/* Search / Load Section */}
                    <div className="flex gap-4 mb-8">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="ENTER BUILDER CODE (e.g. GEN-XY12)"
                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:border-[#0EA5E9] outline-none"
                        />
                        <button
                            onClick={handleLoad}
                            disabled={loading}
                            className="bg-[#0EA5E9] hover:bg-[#0284c7] text-white px-6 py-3 rounded-lg font-bold uppercase disabled:opacity-50 transition-all"
                        >
                            {loading ? '...' : 'Load'}
                        </button>
                    </div>

                    {statusMsg && (
                        <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded text-sm text-center font-mono text-yellow-400 break-all">
                            {statusMsg}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-center">
                            {error}
                        </div>
                    )}

                    {/* Dashboard Content */}
                    {builderData && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Claimable */}
                                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Claimable Balance</div>
                                    <div className="text-3xl font-mono font-bold text-[#0EA5E9]">
                                        ${builderData.claimableBalance.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">USDC</div>

                                    <button
                                        onClick={handleClaim}
                                        disabled={loading || builderData.claimableBalance < 0.01}
                                        className="w-full mt-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm uppercase transition-all"
                                    >
                                        Claim Earnings
                                    </button>
                                </div>

                                {/* Lifetime */}
                                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Lifetime Earnings</div>
                                    <div className="text-3xl font-mono font-bold text-white">
                                        ${builderData.lifetimeEarnings.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">USDC</div>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="bg-black/30 p-6 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase">Builder Profile</h3>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-gray-400 text-sm">Builder Code</span>
                                        <span className="font-mono text-[#0EA5E9]">{builderData.code}</span>
                                    </div>

                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-gray-400 text-sm">Registered Wallet</span>
                                        <div className="text-right">
                                            <div className="font-mono text-xs text-white break-all">{builderData.wallet}</div>
                                            {activeWallet?.address === builderData.wallet ? (
                                                <span className="text-[10px] text-green-400 bg-green-900/20 px-1 rounded">CONNECTED</span>
                                            ) : (
                                                <span className="text-[10px] text-yellow-400 bg-yellow-900/20 px-1 rounded">DIFFERENT WALLET CONNECTED</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setShowUpdateModal(true)}
                                        className="text-xs text-gray-400 hover:text-white underline decoration-dashed"
                                    >
                                        Update Registered Wallet
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Footer />

            {/* Update Wallet Modal */}
            {showUpdateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-[#1a1a1a] p-8 rounded-xl border border-white/10 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Update Wallet</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Enter the new wallet address. You must sign the transaction with your
                            <strong> CURRENT registered wallet</strong> to authorize this change.
                        </p>

                        <input
                            type="text"
                            value={newWalletInput}
                            onChange={(e) => setNewWalletInput(e.target.value)}
                            placeholder="New Wallet Public Key"
                            className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm mb-6 focus:border-[#0EA5E9] outline-none"
                        />

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                className="flex-1 py-3 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateWallet}
                                disabled={loading || !newWalletInput}
                                className="flex-1 py-3 bg-[#0EA5E9] hover:bg-[#0284c7] rounded-lg text-white font-bold transition-all disabled:opacity-50"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
