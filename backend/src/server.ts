import { createServer } from 'http';
import app from './app';
import { WebSocketManager } from './websockets/WebSocketManager';
import { MatchingEngine } from './services/MatchingEngine';
import { connectRedis } from './utils/redis';
import { prisma } from './utils/prisma';

const port = process.env.PORT || 3000;
const server = createServer(app);

// Initialize Services
const wsManager = new WebSocketManager(server);
const matchingEngine = new MatchingEngine();

// Start
async function start() {
    await connectRedis();

    // DEV ONLY: Clear all order book state on startup for clean testing
    // In production, you'd have proper session lifecycle management
    console.log('DEV MODE: Clearing all sessions, bids, and matches...');
    await prisma.match.deleteMany();
    await prisma.bid.deleteMany();
    await prisma.session.deleteMany();
    console.log('Order book cleared.');

    matchingEngine.start();

    server.listen(port, () => {
        console.log(`Backend running on http://localhost:${port}`);
        console.log(`WebSocket server running on ws://localhost:${port}/v1/ws/events`);
    });
}

start().catch(console.error);
