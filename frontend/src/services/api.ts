const API_URL = 'http://localhost:3000/v1';

export const api = {
    async submitBid(bid: any) {
        const response = await fetch(`${API_URL}/agents/bids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bid)
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

    async completeMatch(matchId: string, data: { answer: string; actualDuration: number; exitedEarly: boolean }) {
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

    async dismissMatch(matchId: string) {
        const response = await fetch(`${API_URL}/matches/${matchId}/dismiss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
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
    }
};
