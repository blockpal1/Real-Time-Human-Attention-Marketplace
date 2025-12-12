import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './indexLanding.css'

import { PrivyProvider } from '@privy-io/react-auth';

// Replace with your Privy App ID
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                loginMethods: ['email', 'google', 'apple'],
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
