import { Bid, BidStatus } from '../types/bid';

/**
 * OrderBook - Priority queue for bids ordered by maxPricePerSecond (descending)
 * Uses a binary max-heap for O(log n) insertion and O(1) peek
 */
export class OrderBook {
    private heap: Bid[] = [];
    private bidMap: Map<string, number> = new Map(); // bidId -> heap index

    /**
     * Add a bid to the order book
     * Time complexity: O(log n)
     */
    addBid(bid: Bid): void {
        if (bid.status !== BidStatus.PENDING) {
            throw new Error(`Cannot add bid with status ${bid.status}`);
        }

        // Check if bid already exists
        if (this.bidMap.has(bid.bidId)) {
            throw new Error(`Bid ${bid.bidId} already exists in order book`);
        }

        // Add to end of heap
        const index = this.heap.length;
        this.heap.push(bid);
        this.bidMap.set(bid.bidId, index);

        // Bubble up to maintain heap property
        this.bubbleUp(index);
    }

    /**
     * Peek at the highest-priced bid without removing it
     * Time complexity: O(1)
     */
    peekTop(): Bid | null {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    /**
     * Remove and return the highest-priced bid
     * Time complexity: O(log n)
     */
    popTop(): Bid | null {
        if (this.heap.length === 0) return null;

        const top = this.heap[0];
        this.removeBidAtIndex(0);
        return top;
    }

    /**
     * Remove a specific bid by ID
     * Time complexity: O(log n)
     */
    removeBid(bidId: string): boolean {
        const index = this.bidMap.get(bidId);
        if (index === undefined) return false;

        this.removeBidAtIndex(index);
        return true;
    }

    /**
     * Get a bid by ID without removing
     * Time complexity: O(1)
     */
    getBid(bidId: string): Bid | null {
        const index = this.bidMap.get(bidId);
        if (index === undefined) return null;
        return this.heap[index];
    }

    /**
     * Update a bid's status (e.g., to MATCHED)
     */
    updateBidStatus(bidId: string, status: BidStatus): boolean {
        const index = this.bidMap.get(bidId);
        if (index === undefined) return false;

        this.heap[index] = { ...this.heap[index], status };
        return true;
    }

    /**
     * Remove all expired bids
     * Time complexity: O(n log n) worst case
     * @returns Number of bids removed
     */
    pruneExpired(now: number = Date.now()): number {
        const expiredIds: string[] = [];

        for (const bid of this.heap) {
            if (bid.expiryTimestamp <= now) {
                expiredIds.push(bid.bidId);
            }
        }

        for (const bidId of expiredIds) {
            this.removeBid(bidId);
        }

        return expiredIds.length;
    }

    /**
     * Get all pending bids above a minimum price
     * Time complexity: O(n)
     */
    getBidsAbovePrice(minPrice: number): Bid[] {
        return this.heap.filter(
            (bid) =>
                bid.status === BidStatus.PENDING && bid.maxPricePerSecond >= minPrice
        );
    }

    /**
     * Get the current number of bids
     */
    get size(): number {
        return this.heap.length;
    }

    /**
     * Get all bids (for debugging/testing)
     */
    getAllBids(): Bid[] {
        return [...this.heap];
    }

    /**
     * Clear all bids
     */
    clear(): void {
        this.heap = [];
        this.bidMap.clear();
    }

    // ============================================================
    // Private heap operations
    // ============================================================

    private removeBidAtIndex(index: number): void {
        const bid = this.heap[index];
        this.bidMap.delete(bid.bidId);

        if (index === this.heap.length - 1) {
            // Removing last element, just pop
            this.heap.pop();
        } else {
            // Move last element to this position
            const last = this.heap.pop()!;
            this.heap[index] = last;
            this.bidMap.set(last.bidId, index);

            // Restore heap property
            const parentIndex = Math.floor((index - 1) / 2);
            if (index > 0 && this.compare(index, parentIndex) > 0) {
                this.bubbleUp(index);
            } else {
                this.bubbleDown(index);
            }
        }
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compare(index, parentIndex) <= 0) break;

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const length = this.heap.length;

        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let largest = index;

            if (leftChild < length && this.compare(leftChild, largest) > 0) {
                largest = leftChild;
            }

            if (rightChild < length && this.compare(rightChild, largest) > 0) {
                largest = rightChild;
            }

            if (largest === index) break;

            this.swap(index, largest);
            index = largest;
        }
    }

    private compare(i: number, j: number): number {
        // Higher price = higher priority
        const priceDiff = this.heap[i].maxPricePerSecond - this.heap[j].maxPricePerSecond;
        if (priceDiff !== 0) return priceDiff;

        // Tie-breaker: earlier created bid wins
        return this.heap[j].createdAt - this.heap[i].createdAt;
    }

    private swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
        this.bidMap.set(this.heap[i].bidId, i);
        this.bidMap.set(this.heap[j].bidId, j);
    }
}
