import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';

interface ExtendedWebSocket extends WebSocket {
    sessionId?: string;
    isAlive: boolean;
}

export class WebSocketManager {
    private wss: WebSocketServer;
    private sessions: Map<string, ExtendedWebSocket> = new Map();

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server, path: '/v1/ws/events' });
        this.init();
        this.subscribeToRedis();
    }

    private init() {
        this.wss.on('connection', (ws: ExtendedWebSocket, req) => {
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });

            console.log('New WS Connection established');

            // Set up ping interval for this client? Or global interval.

            ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    await this.handleMessage(ws, msg);
                } catch (e) {
                    console.error('WS Message Error:', e);
                }
            });

            ws.on('close', async () => {
                if (ws.sessionId) {
                    this.sessions.delete(ws.sessionId);
                    await prisma.session.update({
                        where: { id: ws.sessionId },
                        data: { connected: false }
                    });
                    console.log(`Session disconnected: ${ws.sessionId}`);
                }
            });
        });

        // Heartbeat
        setInterval(() => {
            this.wss.clients.forEach((ws: WebSocket) => {
                const extWs = ws as ExtendedWebSocket;
                if (!extWs.isAlive) return ws.terminate();
                extWs.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    private async handleMessage(ws: ExtendedWebSocket, msg: any) {
        if (msg.type === 'AUTH') {
            const token = msg.token;
            try {
                const secret = process.env.JWT_SECRET || 'dev-secret';
                const decoded = jwt.verify(token, secret) as { sessionId: string };

                ws.sessionId = decoded.sessionId;
                this.sessions.set(decoded.sessionId, ws);

                await prisma.session.update({
                    where: { id: decoded.sessionId },
                    data: { connected: true }
                });

                ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', sessionId: decoded.sessionId }));
                console.log(`WS Authenticated: ${decoded.sessionId}`);
            } catch (e) {
                ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'Invalid Token' }));
                ws.close();
            }
        }
        else if (msg.type === 'ENGAGEMENT') {
            if (!ws.sessionId) return;
            // Handle engagement stream
            // Check active match locally or in DB
            // In high perf, we don't write every tick to DB. We aggregate in Redis.
            if (redis.isOpen) {
                // await redis.set(`session:${ws.sessionId}:last_engagement`, JSON.stringify(msg.data), { EX: 5 });
            }
        }
    }

    private async subscribeToRedis() {
        if (!redis.isOpen) await redis.connect();

        const subscriber = redis.duplicate();
        await subscriber.connect();

        await subscriber.subscribe('marketplace_events', (message) => {
            const event = JSON.parse(message);

            if (event.type === 'MATCH_CREATED') {
                const ws = this.sessions.get(event.sessionId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'MATCH_FOUND',
                        matchId: event.matchId,
                        bidId: event.bidId,
                        targetUrl: event.targetUrl,
                        price: event.price
                    }));
                }
            }
            else if (event.type === 'BID_CREATED') {
                // Broadcast to all connected monitors/clients
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'bid',
                            payload: event.payload
                        }));
                    }
                });
            }
            else if (event.type === 'ASK_CREATED') {
                // Broadcast to all connected monitors/clients
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'ask',
                            payload: event.payload
                        }));
                    }
                });
            }
        });
    }
}
