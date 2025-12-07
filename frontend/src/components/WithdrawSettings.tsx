import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// This component handles "Ejecting" (linking a real wallet) and Withdrawing/Adding Liquidity
export const WithdrawSettings: React.FC = () => {
    const { user, linkWallet, authenticated } = usePrivy();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    if (!authenticated || !user) {
        return null;
    }

    // Note: user.linkedAccounts contains all accounts. We need to filter for external wallets if needed.
    // For simplicity, we just provide the Link Wallet button which Privy handles intelligently.

    const handleWithdraw = async () => {
        try {
            setStatus('loading');
            // TODO: Call Backend API to trigger 'payout_user'
            // const response = await fetch('/api/payout', { ... });

            console.log("Simulating withdrawal request to backend...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            setStatus('success');
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg text-white space-y-4">
            <h2 className="text-xl font-bold">Wallet & Liquidity</h2>

            <div className="flex flex-col space-y-2">
                <div className="text-sm text-gray-400">Connected Embedded Wallet:</div>
                <div className="font-mono text-xs bg-gray-900 p-2 rounded">
                    {user.wallet?.address || "No embedded wallet"}
                </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
                <h3 className="font-semibold mb-2">Link External Wallet</h3>
                <p className="text-sm text-gray-400 mb-3">
                    Connect a Phantom wallet to withdraw earnings or add liquidity.
                </p>
                <button
                    onClick={linkWallet}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >
                    Link Wallet (Phantom)
                </button>
            </div>

            <div className="pt-4 border-t border-gray-700">
                <h3 className="font-semibold mb-2">Withdraw Earnings</h3>
                <p className="text-sm text-gray-400 mb-3">
                    Gasless withdrawal powered by Fuel Tank.
                </p>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleWithdraw}
                        disabled={status === 'loading'}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                        {status === 'loading' ? 'Processing...' : 'Withdraw All to Linked Wallet'}
                    </button>
                </div>
                {status === 'success' && <div className="text-green-400 text-sm mt-2">Withdrawal successful!</div>}
            </div>
        </div>
    );
};
