const API_URL = 'http://localhost:3000/v1';

export const api = {
    // submitBid removed: Use useCampaign hook for non-custodial funding

    async startSession(pubkey: string, price: number) {
        const response = await fetch(`${API_URL}/users/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pubkey, price_floor_micros: price })
        });
        if (!response.ok) throw new Error('Session start failed');
        return response.json();
    },

    async getActiveBids() {
        const response = await fetch(`${API_URL}/agents/bids`);
        if (!response.ok) return [];
        return response.json();
    },

    async getActiveAsks() {
        const response = await fetch(`${API_URL}/users/sessions`);
        if (!response.ok) return [];
        return response.json();
    },

    async completeMatch(matchId: string, data: { answer: string; actualDuration: number; exitedEarly: boolean; bidId?: string; wallet?: string | null }) {
        const response = await fetch(`${API_URL}/matches/${matchId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Match completion failed');
        return response.json();
    },

    async getUserEarnings(pubkey: string) {
        const response = await fetch(`${API_URL}/users/${pubkey}/earnings`);
        if (!response.ok) throw new Error('Failed to fetch earnings');
        return response.json();
    },

    async getSessionHistory(pubkey: string, limit = 50) {
        const response = await fetch(`${API_URL}/users/${pubkey}/sessions?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch session history');
        return response.json();
    },

    async getAgentCampaigns(pubkey: string) {
        const response = await fetch(`${API_URL}/agents/${pubkey}/campaigns`);
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        return response.json();
    },

    async getCampaignResponses(bidId: string) {
        const response = await fetch(`${API_URL}/campaigns/${bidId}/responses`);
        if (!response.ok) throw new Error('Failed to fetch campaign responses');
        return response.json();
    },

    async dismissMatch(matchId: string, bidId?: string, pubkey?: string) {
        const response = await fetch(`${API_URL}/matches/${matchId}/dismiss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bidId, pubkey })
        });
        if (!response.ok) throw new Error('Failed to dismiss match');
        return response.json();
    },

    // x402 Protocol Orders
    async getX402Orders() {
        const response = await fetch(`${API_URL}/orderbook`);
        if (!response.ok) return { orders: [] };
        return response.json();
    },

    async fillX402Order(txHash: string) {
        const response = await fetch(`${API_URL}/orders/${txHash}/fill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fill order');
        }
        return response.json();
    },

    async cancelSession(pubkey: string) {
        const response = await fetch(`${API_URL}/users/session/cancel`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pubkey })
        });
        if (!response.ok) throw new Error('Failed to cancel session');
        return response.json();
    },

    async acceptHighestBid(pubkey: string, duration?: number) {
        const response = await fetch(`${API_URL}/users/session/accept-highest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pubkey, duration })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'No bids available');
        }
        return response.json();
    },

    async getSignalQuality(wallet: string) {
        const response = await fetch(`${API_URL}/users/${wallet}/signal-quality`);
        if (!response.ok) {
            throw new Error('Failed to fetch signal quality');
        }
        return response.json();
    },

    async getUserBalance(wallet: string) {
        const response = await fetch(`${API_URL}/users/${wallet}/balance`);
        if (!response.ok) {
            throw new Error('Failed to fetch balance');
        }
        const data = await response.json();

        // Query on-chain USDC balance
        let onChainBalance = 0;
        try {
            const { Connection, PublicKey } = await import('@solana/web3.js');
            const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');

            const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
            const IS_DEVNET = RPC_URL.includes('devnet');
            const USDC_MINT = new PublicKey(
                IS_DEVNET
                    ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'  // Devnet USDC
                    : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  // Mainnet USDC
            );

            const connection = new Connection(RPC_URL, 'confirmed');
            const userPubkey = new PublicKey(wallet);
            const userATA = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

            try {
                const tokenAccount = await getAccount(connection, userATA);
                // USDC has 6 decimals
                onChainBalance = Number(tokenAccount.amount) / 1_000_000;
            } catch {
                // Token account doesn't exist yet - balance is 0
                onChainBalance = 0;
            }
        } catch (e) {
            console.error('Failed to fetch on-chain balance:', e);
        }

        return {
            pending: data.balance || 0,  // Claimable earnings (from Redis)
            wallet: onChainBalance  // Actual on-chain USDC balance
        };
    },

    async getSeasonPoints(wallet: string) {
        const response = await fetch(`${API_URL}/users/${wallet}/season-points`);
        if (!response.ok) {
            throw new Error('Failed to fetch season points');
        }
        const data = await response.json();
        return data.points || 0;
    },

    // Non-Custodial Claims
    async getClaimBalance(userPubkey: string) {
        // Fetch aggregated unclaimed earnings
        const response = await fetch(`${API_URL}/claims/balance?userPubkey=${userPubkey}`);
        if (!response.ok) throw new Error('Failed to fetch claim balance');
        return response.json();
    },

    async withdrawEarnings(userPubkey: string, signMessage?: (message: Uint8Array) => Promise<Uint8Array>) {
        // CRIT-1 FIX: Include signed message for wallet ownership verification
        const timestamp = Date.now();
        const message = `Claim request for ${userPubkey} at ${timestamp}`;

        let signature: string | undefined;
        if (signMessage) {
            try {
                const { encode } = await import('bs58');
                const messageBytes = new TextEncoder().encode(message);
                const signatureBytes = await signMessage(messageBytes);
                signature = encode(signatureBytes);
            } catch (e) {
                console.error('Failed to sign claim message:', e);
                throw new Error('Wallet signature required to claim earnings');
            }
        } else {
            throw new Error('signMessage function required for secure claims');
        }

        // Request backend to prepare a transaction (Step 1)
        const response = await fetch(`${API_URL}/claims/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPubkey, signature, timestamp })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Withdraw failed');
        }
        return response.json();
    },

    async submitClaim(userPubkey: string, claimId: string, signature: string) {
        // Submit signature to finalize claim (Step 2)
        const response = await fetch(`${API_URL}/claims/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPubkey, claimId, signedTransaction: signature })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Claim submission failed');
        }
        return response.json();
    }
};
