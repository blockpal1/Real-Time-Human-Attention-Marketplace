import fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { createClient } from 'redis';
import * as fs from 'fs';

const server = fastify({ logger: true });

const log = (msg: string) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync('debug.log', entry); } catch (e) { }
    console.log(msg);
};

log('Gateway process starting...');

// Enable CORS for ALL origins to prevent browser blocking
server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

server.register(websocket);

// Redis Clients
const publisher = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

// Manage Monitor Connections
const monitorClients = new Set<any>();

server.register(async function (fastify) {

    // WebSocket Endpoint for Chrome Extension (Producers)
    fastify.get('/ws/events', { websocket: true }, (connection, req) => {
        console.log('Extension connected');

        connection.socket.on('message', (message: any) => {
            try {
                const event = JSON.parse(message.toString());
                // Forward to Matcher via Redis
                publisher.publish('engagement_events', JSON.stringify(event));
                connection.socket.send(JSON.stringify({ status: 'ack', seq: event.seq }));
            } catch (e) {
                console.error('Invalid message format', e);
            }
        });
    });

    // WebSocket Endpoint for Monitor Dashboard (Consumers)
    fastify.get('/ws/monitor', { websocket: true }, (connection, req) => {
        try {
            log('Monitor connecting...');

            // Fastify-websocket often passes the socket directly as 'connection' or inside it.
            const socket = (connection as any).socket || connection;

            if (!socket) {
                console.error('CRITICAL: Monitor connection invalid (no socket found)');
                return;
            }

            log('Monitor connected (socket ready)');

            const clientObj = { socket };
            monitorClients.add(clientObj);

            // Send initial status
            socket.send(JSON.stringify({ type: 'status', msg: 'Connected to Gateway Monitor Stream 🟢' }));

            socket.on('close', () => {
                monitorClients.delete(clientObj);
                log('Monitor disconnected');
            });

            socket.on('error', (err: any) => {
                console.error('Monitor socket error:', err);
            });
        } catch (e) {
            console.error('Error in WS handler:', e);
        }
    });

    // REST Endpoint for Agents
    fastify.post('/v1/bids', async (request, reply) => {
        try {
            const bid = request.body as any;
            const bidId = 'bid_' + Date.now();
            const enrichedBid = {
                ...bid,
                bidId,
                timestamp: Date.now(),
                // Normalize for Frontend/OrderBook
                duration: bid.duration_per_user || 30,
                quantity: bid.target_quantity || 1
            };

            log(`Received Bid: ${JSON.stringify(enrichedBid)}`);
            // Forward to Matcher via Redis
            await publisher.publish('agent_bids', JSON.stringify(enrichedBid));

            // Also notify monitor immediately about the new bid
            broadcastToMonitors({ type: 'bid', payload: enrichedBid });

            return { status: 'queued', bid_id: bidId };
        } catch (e) {
            console.error('Error processing bid:', e);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // REST Endpoint for Users (Start Session / Ask)
    fastify.post('/v1/users/session/start', async (request, reply) => {
        try {
            const { pubkey, price_floor_micros } = request.body as any;
            const sessionId = 'session_' + Date.now();

            const askEvent = {
                type: 'ASK_CREATED',
                payload: {
                    id: sessionId,
                    pricePerSecond: price_floor_micros,
                    status: 'active',
                    pubkey
                }
            };

            log(`Received Ask/Session: ${JSON.stringify(askEvent)}`);

            // Publish to Redis (for Matcher)
            await publisher.publish('marketplace_events', JSON.stringify(askEvent));

            // Notify Monitors
            broadcastToMonitors({ type: 'ask', payload: askEvent.payload });

            // Return mock token
            return { session_token: 'mock_token_' + sessionId, id: sessionId };

        } catch (e) {
            console.error('Error starting session:', e);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

});

function broadcastToMonitors(data: any) {
    if (monitorClients.size > 0) {
        log(`Broadcasting to ${monitorClients.size} clients. Type: ${data.type}`);
    } else {
        log(`SKIPPING BROADCAST: No monitor clients connected (Size: ${monitorClients.size})`);
    }
    for (const client of monitorClients) {
        try {
            if (client.socket && client.socket.readyState === 1) {
                client.socket.send(JSON.stringify(data));
            } else {
                log(`Client socket invalid state: ${client.socket?.readyState}`);
                if (client.socket?.readyState > 1) monitorClients.delete(client);
            }
        } catch (err) {
            console.error('Error broadcasting:', err);
        }
    }
}

const start = async () => {
    try {
        await publisher.connect();
        await subscriber.connect();

        // Subscribe to matches from Matcher
        await subscriber.subscribe('market_matches', (message: any) => {
            const match = JSON.parse(message);
            // Broadcast match to all connected monitors
            broadcastToMonitors({ type: 'match', payload: match });
        });

        await server.listen({ port: 3000, host: '0.0.0.0' });
        log('Gateway running on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
