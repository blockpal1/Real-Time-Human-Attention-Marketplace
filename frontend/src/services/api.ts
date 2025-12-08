const API_URL = 'http://localhost:3000/v1';

export const api = {
    async submitBid(bid: any) {
        const response = await fetch(`${API_URL}/agents/bids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bid)
        });
        if (!response.ok) throw new Error('Bid submission failed');
        return response.json();
    },

    async startSession(pubkey: string, price: number) {
        // Gateway needs this endpoint
        const response = await fetch(`${API_URL}/users/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pubkey, price_floor_micros: price })
        });
        if (!response.ok) throw new Error('Session start failed');
        return response.json();
    }
};
