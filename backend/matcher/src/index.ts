import { OrderBook, Bid, Ask } from './orderbook';
import { createClient } from 'redis';

const book = new OrderBook();

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const publisher = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

async function startMatcher() {
    await redisClient.connect();
    await publisher.connect();

    console.log('[Matcher] Connected to Redis. Implementation: Real-Time.');

    // Subscribe to Agent Bids
    await redisClient.subscribe('agent_bids', (message) => {
        try {
            const bidData = JSON.parse(message);
            const bid: Bid = {
                bidId: bidData.bidId,
                maxPrice: parseInt(bidData.max_price_per_second) || 10,
                requiredScore: parseFloat(bidData.required_attention_score) || 0.5,
                timestamp: Date.now()
            };
            book.addBid(bid);
            console.log(`[Matcher] New Bid: ${bid.maxPrice}µs. Book depth: ${book.size()}`);
        } catch (e) {
            console.error('[Matcher] Error parsing bid:', e);
        }
    });

    // Subscribe to Engagement Events (The Ask)
    await redisClient.subscribe('engagement_events', async (message) => {
        try {
            const event = JSON.parse(message);

            // Convert Engagement Event to an "Ask" (Market Order)
            // In a real system, we'd check if specific user is "selling"
            // For MVP, if we receive an event with high enough score, it's a sell offer
            if (event.payload?.attention_score) {
                const ask: Ask = {
                    userId: 'user_extension', // Single user for MVP demo
                    minPrice: event.payload?.min_price || 1,
                    currentScore: event.payload.attention_score,
                    timestamp: Date.now()
                };

                const match = book.match(ask);
                if (match) {
                    console.log(`>>> MATCH! User ${ask.userId} sold attention to ${match.bidId} @ ${match.maxPrice}µs`);

                    // Publish Match Event
                    await publisher.publish('market_matches', JSON.stringify({
                        bidId: match.bidId,
                        maxPrice: match.maxPrice,
                        userId: ask.userId,
                        timestamp: Date.now()
                    }));
                }
            }
        } catch (e) {
            console.error('[Matcher] Error parsing event:', e);
        }
    });
}

startMatcher();
