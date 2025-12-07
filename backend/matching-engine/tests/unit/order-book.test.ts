import { OrderBook } from '../../src/engine/order-book';
import { Bid, BidStatus } from '../../src/types/bid';

function createTestBid(overrides: Partial<Bid> = {}): Bid {
    const now = Date.now();
    return {
        bidId: `bid-${Math.random().toString(36).substring(7)}`,
        agentPubkey: 'agent-pubkey-123',
        maxPricePerSecond: 100,
        requiredAttentionScore: 0.5,
        minAttentionSeconds: 5,
        expiryTimestamp: now + 60000,
        createdAt: now,
        status: BidStatus.PENDING,
        ...overrides,
    };
}

describe('OrderBook', () => {
    let orderBook: OrderBook;

    beforeEach(() => {
        orderBook = new OrderBook();
    });

    describe('addBid', () => {
        it('should add a bid to the order book', () => {
            const bid = createTestBid();
            orderBook.addBid(bid);

            expect(orderBook.size).toBe(1);
            expect(orderBook.getBid(bid.bidId)).toEqual(bid);
        });

        it('should reject duplicate bids', () => {
            const bid = createTestBid();
            orderBook.addBid(bid);

            expect(() => orderBook.addBid(bid)).toThrow('already exists');
        });

        it('should reject non-pending bids', () => {
            const bid = createTestBid({ status: BidStatus.MATCHED });

            expect(() => orderBook.addBid(bid)).toThrow('Cannot add bid with status');
        });
    });

    describe('peekTop / popTop', () => {
        it('should return null for empty order book', () => {
            expect(orderBook.peekTop()).toBeNull();
            expect(orderBook.popTop()).toBeNull();
        });

        it('should return highest priced bid', () => {
            const lowBid = createTestBid({ bidId: 'low', maxPricePerSecond: 50 });
            const highBid = createTestBid({ bidId: 'high', maxPricePerSecond: 200 });
            const midBid = createTestBid({ bidId: 'mid', maxPricePerSecond: 100 });

            orderBook.addBid(lowBid);
            orderBook.addBid(highBid);
            orderBook.addBid(midBid);

            expect(orderBook.peekTop()?.bidId).toBe('high');
            expect(orderBook.size).toBe(3);

            expect(orderBook.popTop()?.bidId).toBe('high');
            expect(orderBook.size).toBe(2);

            expect(orderBook.popTop()?.bidId).toBe('mid');
            expect(orderBook.popTop()?.bidId).toBe('low');
            expect(orderBook.size).toBe(0);
        });

        it('should use creation time as tie-breaker', () => {
            const now = Date.now();
            const earlierBid = createTestBid({
                bidId: 'earlier',
                maxPricePerSecond: 100,
                createdAt: now - 1000,
            });
            const laterBid = createTestBid({
                bidId: 'later',
                maxPricePerSecond: 100,
                createdAt: now,
            });

            orderBook.addBid(laterBid);
            orderBook.addBid(earlierBid);

            // Earlier bid should win tie-breaker
            expect(orderBook.popTop()?.bidId).toBe('earlier');
        });
    });

    describe('removeBid', () => {
        it('should remove a specific bid by ID', () => {
            const bid1 = createTestBid({ bidId: 'bid1', maxPricePerSecond: 100 });
            const bid2 = createTestBid({ bidId: 'bid2', maxPricePerSecond: 50 });

            orderBook.addBid(bid1);
            orderBook.addBid(bid2);

            expect(orderBook.removeBid('bid1')).toBe(true);
            expect(orderBook.size).toBe(1);
            expect(orderBook.peekTop()?.bidId).toBe('bid2');
        });

        it('should return false for non-existent bid', () => {
            expect(orderBook.removeBid('non-existent')).toBe(false);
        });
    });

    describe('pruneExpired', () => {
        it('should remove expired bids', () => {
            const now = Date.now();
            const validBid = createTestBid({
                bidId: 'valid',
                expiryTimestamp: now + 60000,
            });
            const expiredBid = createTestBid({
                bidId: 'expired',
                expiryTimestamp: now - 1000,
            });

            orderBook.addBid(validBid);
            orderBook.addBid(expiredBid);

            const removed = orderBook.pruneExpired(now);

            expect(removed).toBe(1);
            expect(orderBook.size).toBe(1);
            expect(orderBook.getBid('valid')).toBeTruthy();
            expect(orderBook.getBid('expired')).toBeNull();
        });
    });

    describe('getBidsAbovePrice', () => {
        it('should return bids above minimum price', () => {
            orderBook.addBid(createTestBid({ bidId: 'bid1', maxPricePerSecond: 50 }));
            orderBook.addBid(createTestBid({ bidId: 'bid2', maxPricePerSecond: 100 }));
            orderBook.addBid(createTestBid({ bidId: 'bid3', maxPricePerSecond: 150 }));

            const bids = orderBook.getBidsAbovePrice(75);

            expect(bids.length).toBe(2);
            expect(bids.map((b) => b.bidId).sort()).toEqual(['bid2', 'bid3']);
        });
    });

    describe('heap integrity', () => {
        it('should maintain heap property with many operations', () => {
            // Add bids in random order
            const prices = [5, 15, 10, 20, 8, 25, 3, 12];
            prices.forEach((price, i) => {
                orderBook.addBid(
                    createTestBid({ bidId: `bid${i}`, maxPricePerSecond: price })
                );
            });

            // Pop all and verify descending order
            const popped: number[] = [];
            while (orderBook.size > 0) {
                const bid = orderBook.popTop();
                if (bid) popped.push(bid.maxPricePerSecond);
            }

            expect(popped).toEqual([25, 20, 15, 12, 10, 8, 5, 3]);
        });

        it('should handle interleaved add/remove operations', () => {
            orderBook.addBid(createTestBid({ bidId: 'a', maxPricePerSecond: 10 }));
            orderBook.addBid(createTestBid({ bidId: 'b', maxPricePerSecond: 20 }));
            orderBook.popTop(); // Remove b
            orderBook.addBid(createTestBid({ bidId: 'c', maxPricePerSecond: 15 }));
            orderBook.removeBid('a');
            orderBook.addBid(createTestBid({ bidId: 'd', maxPricePerSecond: 5 }));

            expect(orderBook.size).toBe(2);
            expect(orderBook.popTop()?.bidId).toBe('c');
            expect(orderBook.popTop()?.bidId).toBe('d');
        });
    });
});
