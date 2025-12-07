export interface Bid {
    bidId: string;
    maxPrice: number;
    requiredScore: number;
    timestamp: number;
}

export interface Ask {
    userId: string;
    minPrice: number;
    currentScore: number;
    timestamp: number;
}

export class OrderBook {
    private bids: Bid[] = [];

    addBid(bid: Bid) {
        this.bids.push(bid);
        this.bids.sort((a, b) => b.maxPrice - a.maxPrice); // Descending price
    }

    match(ask: Ask): Bid | null {
        // Greedy match: Find highest paying bid that satisfies constraints
        const matchIndex = this.bids.findIndex(bid =>
            bid.maxPrice >= ask.minPrice &&
            ask.currentScore >= bid.requiredScore
        );

        if (matchIndex !== -1) {
            return this.bids.splice(matchIndex, 1)[0];
        }

        return null;
    }

    size() {
        return this.bids.length;
    }
}
