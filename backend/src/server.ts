import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { WebSocketManager } from './websockets/WebSocketManager';
import { startExpirationJob } from './middleware/x402OrderBook';
import { MatchingEngine } from './services/MatchingEngine';
import { connectRedis, redis, redisClient } from './utils/redis';
import { archiverService } from './services/ArchiverService';
import { configService } from './services/ConfigService';

const port = process.env.PORT || 3000;
const server = createServer(app);

// Initialize Services
const wsManager = new WebSocketManager(server);
const matchingEngine = new MatchingEngine();

// Hydrate order book from Redis (x402 orders)
async function hydrateOrderBook() {
    console.log('[Hydration] Loading active orders from Redis...');

    if (!redisClient.isOpen) {
        console.log('[Hydration] Redis not connected, skipping hydration');
        return;
    }

    const openOrderIds = await redisClient.getOpenOrders();
    console.log(`[Hydration] Found ${openOrderIds.length} open x402 orders`);

    // Publish each order to WebSocket so frontend can display them
    for (const txHash of openOrderIds) {
        const order = await redisClient.getOrder(txHash) as any;
        if (order && order.status === 'open') {
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'BID_CREATED',
                payload: {
                    bidId: txHash,
                    tx_hash: txHash,
                    price: order.bid,
                    duration: order.duration,
                    quantity: order.quantity,
                    content_url: order.content_url
                }
            }));
        }
    }

    console.log('[Hydration] Order book hydrated successfully');
}

// Start
async function start() {
    await connectRedis();

    // Initialize platform config from Redis
    const mode = await configService.getMode();
    console.log(`[Platform] Mode: ${mode}`);

    // Hydrate order book from Redis
    await hydrateOrderBook();

    // Start services
    matchingEngine.start();
    startExpirationJob(); // Start x402 cleanup job
    archiverService.start(); // Start match history archiver

    server.listen(port, () => {
        console.log(`Backend running on http://localhost:${port}`);
        console.log(`WebSocket server running on ws://localhost:${port}/v1/ws/events`);
    });
}

start().catch(console.error);

// Force restart

