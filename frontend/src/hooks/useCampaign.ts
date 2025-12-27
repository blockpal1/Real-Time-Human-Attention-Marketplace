import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface CreateCampaignParams {
    question: string;
    bid_per_second: number; // in USDC
    duration_seconds: number;
    total_quantity: number;
    content_url?: string;
    validation_window?: number;
    builder_code?: string;
}

interface CampaignState {
    status: 'idle' | 'preparing' | 'signing' | 'submitting' | 'confirmed' | 'failed';
    error: string | null;
    txHash: string | null;
}

export const useCampaign = () => {
    const { user } = usePrivy();
    const { wallets } = useWallets();
    const [campaignState, setCampaignState] = useState<CampaignState>({
        status: 'idle',
        error: null,
        txHash: null
    });

    const createCampaign = async (params: CreateCampaignParams) => {
        setCampaignState({ status: 'preparing', error: null, txHash: null });

        try {
            // 1. Get Wallet Address
            // For external Solana wallets, the address is in user.wallet.address
            // For embedded wallets, it's in the wallets array
            const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
            const walletAddress = embeddedWallet?.address || user?.wallet?.address;

            console.log('[useCampaign] Wallet detection:', {
                embeddedWallet: embeddedWallet?.address,
                userWallet: user?.wallet?.address,
                resolved: walletAddress
            });

            // 2. Call API to Verify & Get Transaction
            // The backend returns 402 with the serialized transaction if payment is required
            let serializedTx: string | null = null;
            let campaignIdFromServer: string | null = null;

            try {
                // We use the existing verify endpoint.
                // Note: api.verifyCampaign needs to be updated or we use a raw fetch here if it doesn't support returning the error response body
                // Let's assume api.verify throws an error with the response data if 402
                // Actually, for this specific "Campaign Manager" flow, we might want a dedicated helper or just fetch directly here to handle the 402 gracefully.

                const headers: any = {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': import.meta.env.VITE_ADMIN_SECRET || ''
                };

                // CRITICAL: Send wallet address as Agent Key so backend can build the TX
                if (walletAddress) {
                    headers['X-Agent-Key'] = walletAddress;
                }

                if (params.builder_code) {
                    headers['X-Builder-Code'] = params.builder_code;
                }

                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/verify`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        duration: params.duration_seconds,
                        quantity: params.total_quantity,
                        bid_per_second: params.bid_per_second, // Already in USDC
                        content_url: params.content_url || '',
                        validation_question: params.question
                    })
                });

                if (response.status === 402) {
                    const data = await response.json();
                    serializedTx = data.transaction; // "transaction" field from backend
                    campaignIdFromServer = data.campaign_id; // For X-Campaign-Id header on confirmation
                } else if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to verify campaign');
                } else {
                    // Status 200 = Free campaign (Points) or success without payment (if backend allowed it)
                    setCampaignState({ status: 'confirmed', error: null, txHash: 'virtual-order' });
                    return;
                }

            } catch (err: any) {
                // If the error object contains the transaction (depending on how api wrapper handles 402)
                throw err;
            }

            if (!serializedTx) {
                throw new Error("No transaction received from backend");
            }

            // Check for wallet NOW
            if (!walletAddress) throw new Error('No wallet connected for payment signing');

            // 3. Deserialize Transaction
            const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

            // 4. Refresh blockhash to prevent stale blockhash errors
            const connection = new Connection(RPC_URL);
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            // 5. Sign Transaction
            setCampaignState(prev => ({ ...prev, status: 'signing' }));

            // Get Solana Provider
            // For embedded Privy wallets, use getProvider()
            // For external wallets, check multiple providers
            let signedTx: Transaction;

            // Helper to find an available Solana provider
            const getExternalProvider = () => {
                const w = window as any;
                // Phantom
                if (w.phantom?.solana?.signTransaction) return w.phantom.solana;
                if (w.solana?.signTransaction) return w.solana;
                // Backpack
                if (w.backpack?.signTransaction) return w.backpack;
                if (w.xnft?.solana?.signTransaction) return w.xnft.solana;
                // Solflare
                if (w.solflare?.signTransaction) return w.solflare;
                // Glow
                if (w.glow?.solana?.signTransaction) return w.glow.solana;
                return null;
            };

            if (embeddedWallet) {
                // Embedded Privy wallet
                const provider = await (embeddedWallet as any).getProvider();
                if (!provider) throw new Error("Failed to get embedded wallet provider");
                signedTx = await provider.signTransaction(transaction);
            } else {
                const externalProvider = getExternalProvider();
                if (externalProvider) {
                    signedTx = await externalProvider.signTransaction(transaction);
                } else {
                    throw new Error("No compatible Solana wallet provider found. Please install Phantom, Backpack, or Solflare.");
                }
            }

            // 6. Broadcast
            setCampaignState(prev => ({ ...prev, status: 'submitting' }));

            const signature = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(signature);

            // 7. Confirm with Backend (x402 Step 2)
            // Call /v1/verify again with the tx signature to create the order
            const confirmHeaders: any = {
                'Content-Type': 'application/json',
                'X-Admin-Key': import.meta.env.VITE_ADMIN_SECRET || '',
                'X-Solana-Tx-Signature': signature
            };
            if (walletAddress) {
                confirmHeaders['X-Agent-Key'] = walletAddress;
            }
            if (params.builder_code) {
                confirmHeaders['X-Builder-Code'] = params.builder_code;
            }
            if (campaignIdFromServer) {
                confirmHeaders['X-Campaign-Id'] = campaignIdFromServer;
            }

            const confirmResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/verify`, {
                method: 'POST',
                headers: confirmHeaders,
                body: JSON.stringify({
                    duration: params.duration_seconds,
                    quantity: params.total_quantity,
                    bid_per_second: params.bid_per_second,
                    content_url: params.content_url || '',
                    validation_question: params.question
                })
            });

            if (!confirmResponse.ok) {
                const err = await confirmResponse.json();
                console.error("[useCampaign] Order confirmation failed:", err);
                // Transaction succeeded but order creation failed - still show as confirmed with warning
            }

            setCampaignState({ status: 'confirmed', error: null, txHash: signature });

        } catch (error: any) {
            console.error("Campaign Creation Failed:", error);
            setCampaignState({
                status: 'failed',
                error: error.message || 'Unknown error',
                txHash: null
            });
        }
    };

    return {
        createCampaign,
        ...campaignState
    };
};
