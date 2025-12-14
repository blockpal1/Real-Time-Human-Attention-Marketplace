import { createServer } from 'http';
import app from './app';
import { WebSocketManager } from './websockets/WebSocketManager';
import { MatchingEngine } from './services/MatchingEngine';
import { connectRedis, redis } from './utils/redis';
import { prisma } from './utils/prisma';

const port = process.env.PORT || 3000;
const server = createServer(app);

// Initialize Services
const wsManager = new WebSocketManager(server);
const matchingEngine = new MatchingEngine();

// Hydrate order book from database
async function hydrateOrderBook() {
    console.log('[Hydration] Loading active bids from database...');

    const activeBids = await prisma.bid.findMany({
        where: {
            active: true,
            expiry: { gt: new Date() },
            targetQuantity: { gt: 0 }
        },
        orderBy: { maxPricePerSecond: 'desc' }
    });

    console.log(`[Hydration] Found ${activeBids.length} active bids`);

    // Publish each bid to WebSocket so frontend can display them
    for (const bid of activeBids) {
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'BID_CREATED',
                payload: {
                    bidId: bid.id,
                    max_price_per_second: bid.maxPricePerSecond,
                    price: bid.maxPricePerSecond / 1_000_000,
                    target_url: bid.targetUrl,
                    duration: bid.durationPerUser,
                    quantity: bid.targetQuantity
                }
            }));
        }
    }

    console.log('[Hydration] Order book hydrated successfully');
}

// Start
async function start() {
    await connectRedis();

    // Hydrate order book from persisted bids
    await hydrateOrderBook();

    matchingEngine.start();

    server.listen(port, () => {
        console.log(`Backend running on http://localhost:${port}`);
        console.log(`WebSocket server running on ws://localhost:${port}/v1/ws/events`);
    });
}

start().catch(console.error);
