const API_URL = 'http://localhost:3000/v1';

export const api = {
    async submitBid(bid: any) {
        // Route through x402 middleware which applies spread at creation time
        const headers: any = {
            'Content-Type': 'application/json',
            'X-Admin-Key': import.meta.env.VITE_ADMIN_SECRET || ''  // Read from .env
        };

        if (bid.builder_code) {
            headers['X-Builder-Code'] = bid.builder_code;
        }

        const response = await fetch(`${API_URL}/verify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                duration: bid.duration_per_user,
                quantity: bid.target_quantity,
                bid_per_second: bid.max_price_per_second / 1_000_000, // Convert micros to USDC
                content_url: bid.content_url,
                validation_question: bid.validation_question
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Bid failed: ${errorText || response.statusText}`);
        }
        return response.json();
    },

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
    }
};
