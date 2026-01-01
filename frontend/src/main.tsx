/**
 * main.tsx - Privy Provider Configuration
 * 
 * KEY DESIGN DECISIONS:
 * 1. NO auto connectWallet() on load - this triggers UI popups
 * 2. shouldAutoConnect: false - prevents external wallet auto-popup
 * 3. embeddedWallets.solana.createOnLogin: 'all-users' - auto-creates embedded wallet
 * 4. The embedded wallet is automatically available in useSolanaWallets() after login
 * 5. External wallets only connect on explicit user button click
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./indexLanding.css";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

// =============================================================================
// Configuration
// =============================================================================

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "";

if (!PRIVY_APP_ID) {
    console.error("[Privy] VITE_PRIVY_APP_ID is not set!");
}

// External wallet connectors - shouldAutoConnect: false prevents auto-popup
const solanaConnectors = toSolanaWalletConnectors({
    shouldAutoConnect: false,
});

// Solana RPC endpoints - Use Helius if available for higher rate limits
const SOLANA_DEVNET_RPC = import.meta.env.VITE_HELIUS_DEVNET_RPC || import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_MAINNET_RPC = import.meta.env.VITE_HELIUS_MAINNET_RPC || "https://api.mainnet-beta.solana.com";

// RPC clients
const devnetRpc = createSolanaRpc(SOLANA_DEVNET_RPC);
const devnetRpcSubs = createSolanaRpcSubscriptions(SOLANA_DEVNET_RPC.replace("https", "wss"));
const mainnetRpc = createSolanaRpc(SOLANA_MAINNET_RPC);
const mainnetRpcSubs = createSolanaRpcSubscriptions(SOLANA_MAINNET_RPC.replace("https", "wss"));

// =============================================================================
// Chain Definitions
// =============================================================================

const solanaDevnetChain = {
    id: 103,
    idString: "solana:devnet",
    network: "solana:devnet",
    name: "Solana Devnet",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    rpcUrls: {
        default: { http: [SOLANA_DEVNET_RPC] },
        public: { http: [SOLANA_DEVNET_RPC] },
    },
    blockExplorers: { default: { name: "Solscan", url: "https://solscan.io" } },
};

const solanaMainnetChain = {
    id: 101,
    idString: "solana:mainnet",
    network: "solana:mainnet",
    name: "Solana",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    rpcUrls: {
        default: { http: [SOLANA_MAINNET_RPC] },
        public: { http: [SOLANA_MAINNET_RPC] },
    },
    blockExplorers: { default: { name: "Solscan", url: "https://solscan.io" } },
};

// Minimal EVM placeholder to prevent internal Privy config errors
const evmPlaceholderChain = {
    id: 1,
    idString: "eip155:1",
    network: "ethereum:mainnet",
    name: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [] }, public: { http: [] } },
    blockExplorers: { default: { name: "", url: "" } },
};

// =============================================================================
// Privy Configuration
// =============================================================================

const privyConfig = {
    // Login methods
    loginMethods: ["email", "google", "wallet"] as any,

    // Chain configuration - DEVNET ONLY to force Privy to use devnet RPC
    supportedChains: [solanaDevnetChain] as any,
    defaultChain: solanaDevnetChain,

    // Appearance - Solana only mode
    appearance: {
        walletChainType: "solana-only" as const,
    },

    // Embedded wallet configuration
    // createOnLogin: 'all-users' means the embedded wallet is:
    // 1. Automatically CREATED on first login
    // 2. Automatically CONNECTED to the session on subsequent logins
    // This means useSolanaWallets() will have the embedded wallet without manual connect
    embeddedWallets: {
        solana: {
            createOnLogin: "all-users" as const,
            network: "solana:devnet" as any, // CRITICAL: Force embedded wallets to use devnet
        },
    },

    // Solana RPC configuration
    solana: {
        rpcs: {
            "solana:devnet": {
                rpc: devnetRpc as any,
                rpcSubscriptions: devnetRpcSubs as any,
            },
            "solana:mainnet": {
                rpc: mainnetRpc as any,
                rpcSubscriptions: mainnetRpcSubs as any,
            },
        },
    },

    // External wallet connectors
    externalWallets: {
        solana: {
            connectors: solanaConnectors,
        },
    },

    // Prevent internal undefined errors
    walletOverride: {},
};

console.log("[Privy] Config loaded:", {
    appId: PRIVY_APP_ID ? `${PRIVY_APP_ID.substring(0, 8)}...` : "EMPTY",
    defaultChain: privyConfig.defaultChain.name,
    embeddedWalletMode: privyConfig.embeddedWallets.solana.createOnLogin,
});

// =============================================================================
// App Render
// =============================================================================

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
            <App />
        </PrivyProvider>
    </React.StrictMode>
);
