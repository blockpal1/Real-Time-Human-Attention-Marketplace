import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './indexLanding.css'

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Replace with your Privy App ID
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

const solanaConnectors = toSolanaWalletConnectors({
    // By default, this includes Phantom, Solflare, Backpack, etc.
    shouldAutoConnect: false,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                appearance: {
                    walletChainType: 'solana-only',
                },
                loginMethods: ['email', 'google', 'apple', 'wallet'],
                externalWallets: {
                    solana: {
                        connectors: solanaConnectors,
                    },
                },
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                },
                // Enable Solana support
                solanaClusters: [{ name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' }],
            }}
        >
            <App />
        </PrivyProvider>
    </React.StrictMode>,
)
