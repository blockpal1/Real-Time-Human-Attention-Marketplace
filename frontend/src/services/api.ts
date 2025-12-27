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
        // Backend returns { wallet, balance }
        // For now, treat balance as wallet balance, pending is calculated separately
        return {
            wallet: data.balance || 0,
            pending: 0 // TODO: Backend needs to track pending separately
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

    async withdrawEarnings(userPubkey: string) {
        // Request backend to prepare a transaction (Step 1)
        const response = await fetch(`${API_URL}/claims/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPubkey })
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
            body: JSON.stringify({ userPubkey, claimId, signature })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Claim submission failed');
        }
        return response.json();
    }
};
