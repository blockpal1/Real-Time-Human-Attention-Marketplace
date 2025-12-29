import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { PlaceBid } from '../components/PlaceBid';
import { CampaignAnalytics } from '../components/CampaignAnalytics';
import { Footer } from '../components/Footer';
import { LoginButton } from '../components/LoginButton';

export const CampaignPage: React.FC = () => {
    const { user, authenticated, logout } = usePrivy();
    const { wallets } = useWallets();
    const [duration, setDuration] = useState(10);
    const [view, setView] = useState<'create' | 'analytics'>(() => {
        return window.location.hash === '#analytics' ? 'analytics' : 'create';
    });

    // Determine active wallet address for display
    const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
    const displayAddress = wallet?.address || user?.wallet?.address;

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash === '#analytics') setView('analytics');
            if (hash === '#campaigns') setView('create');
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleViewChange = (newView: 'create' | 'analytics') => {
        setView(newView);
        window.location.hash = newView === 'analytics' ? '#analytics' : '#campaigns';
    };

    return (
        <div className="min-h-screen bg-dark text-main flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-panel">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.location.hash = '#app'}
                        className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
                    >
                        <span>←</span> Market
                    </button>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0EA5E9] to-purple-500">
                        Campaign Console
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                        <button
                            onClick={() => handleViewChange('create')}
                            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${view === 'create'
                                ? 'bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/50'
                                : 'text-gray-400 hover:text-white border border-transparent'
                                }`}
                        >
                            Create
                        </button>
                        <button
                            onClick={() => handleViewChange('analytics')}
                            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${view === 'analytics'
                                ? 'bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/50'
                                : 'text-gray-400 hover:text-white border border-transparent'
                                }`}
                        >
                            Analytics
                        </button>
                    </div>

                    {/* Wallet Control */}
                    <div className="h-6 w-px bg-gray-700 mx-1"></div>

                    {authenticated && displayAddress ? (
                        <div className="flex items-center gap-2 bg-black/40 border border-gray-700 rounded-full pl-3 pr-1 py-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-xs font-mono text-gray-300">
                                {displayAddress.slice(0, 4)}...{displayAddress.slice(-4)}
                            </span>
                            <button
                                onClick={logout}
                                className="ml-2 p-1 hover:bg-red-500/20 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                                title="Disconnect"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="transform scale-90 origin-right">
                            <LoginButton />
                        </div>
                    )}
                </div>
            </div>

            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {view === 'create' ? (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Create New Campaign</h2>
                                <p className="text-gray-400 text-sm">Launch a distributed attention campaign across the grid.</p>
                            </div>
                            <div className="max-w-xl">
                                <PlaceBid duration={duration} setDuration={setDuration} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Campaign Analytics</h2>
                                <p className="text-gray-400 text-sm">Real-time performance metrics for your active campaigns.</p>
                            </div>
                            <CampaignAnalytics agentPubkey="mock-agent-pubkey" />
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};
