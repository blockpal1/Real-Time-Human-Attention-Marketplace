import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { redis, redisClient } from '../utils/redis';

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

                    // Update session in Redis
                    const session = await redisClient.getSession(ws.sessionId) as any;
                    if (session) {
                        session.connected = false;
                        await redisClient.setSession(ws.sessionId, session, 300);
                    }

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

                // Update session connected status in Redis
                const session = await redisClient.getSession(decoded.sessionId) as any;
                if (session) {
                    session.connected = true;
                    await redisClient.setSession(decoded.sessionId, session, 3600);
                }

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
        else if (msg.type === 'ACCEPT_MATCH') {
            console.log(`Match Accepted: ${msg.matchId} by Session ${ws.sessionId}`);
            // In a real system, notify Matching Engine to start session tracking
        }
        else if (msg.type === 'SUBMIT_QA') {
            console.log(`QA Submitted: ${msg.answer} for Match ${msg.matchId}`);
            // Mock Settlement Log
            console.log('SETTLEMENT EXECUTED: Funds released to user.');
        }
    }

    private async subscribeToRedis() {
        if (!redis.isOpen) await redis.connect();

        const subscriber = redis.duplicate();
        await subscriber.connect();

        await subscriber.subscribe('marketplace_events', (message) => {
            const event = JSON.parse(message);

            // BROADCAST ALL EVENTS for Demo/Monitor purposes
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {

                    // 1. MATCH FOUND (Handle both MATCH_CREATED and MATCH_FOUND types)
                    if (event.type === 'MATCH_CREATED' || event.type === 'MATCH_FOUND') {
                        console.log('WS Broadcasting MATCH_FOUND to client');
                        const payload = event.payload || event;
                        client.send(JSON.stringify({
                            type: 'MATCH_FOUND',
                            matchId: payload.matchId || event.matchId,
                            bidId: payload.bidId || event.bidId || null, // Include bidId for dismiss restore
                            price: payload.price || event.price,
                            duration: payload.duration || 30,
                            quantity: 1,
                            topic: typeof payload.topic === 'string' ? payload.topic : 'Ad Campaign',
                            contentUrl: payload.contentUrl || null,
                            validationQuestion: payload.validationQuestion || null
                        }));
                    }
                    // 2. BID CREATED
                    else if (event.type === 'BID_CREATED') {
                        console.log('WS Broadcasting BID_CREATED');
                        client.send(JSON.stringify({ type: 'BID_CREATED', payload: event.payload }));
                    }
                    // 3. ASK CREATED
                    else if (event.type === 'ASK_CREATED') {
                        console.log('WS Broadcasting ASK_CREATED');
                        client.send(JSON.stringify({ type: 'ASK_CREATED', payload: event.payload }));
                    }
                    // 4. BID UPDATED
                    else if (event.type === 'BID_UPDATED') {
                        console.log('WS Broadcasting BID_UPDATED:', event.payload);
                        client.send(JSON.stringify({ type: 'BID_UPDATED', payload: event.payload }));
                    }
                    // 5. BID FILLED / REMOVED
                    else if (event.type === 'BID_FILLED') {
                        client.send(JSON.stringify({ type: 'BID_FILLED', payload: event.payload }));
                    }
                    // 6. ASK MATCHED / REMOVED
                    else if (event.type === 'ASK_MATCHED') {
                        client.send(JSON.stringify({ type: 'ASK_MATCHED', payload: event.payload }));
                    }
                    // 6b. ASK CANCELLED
                    else if (event.type === 'ASK_CANCELLED') {
                        console.log('WS Broadcasting ASK_CANCELLED');
                        client.send(JSON.stringify({ type: 'ASK_CANCELLED', payload: event.payload }));
                    }
                    // 7. MATCH COMPLETED (Human submitted answer)
                    else if (event.type === 'MATCH_COMPLETED') {
                        console.log('WS Broadcasting MATCH_COMPLETED to agent');
                        client.send(JSON.stringify({ type: 'MATCH_COMPLETED', payload: event.payload }));
                    }
                    // 8. VALIDATION RESULT (Agent approved/rejected)
                    else if (event.type === 'VALIDATION_RESULT') {
                        console.log('WS Broadcasting VALIDATION_RESULT to human');
                        client.send(JSON.stringify({ type: 'VALIDATION_RESULT', payload: event.payload }));
                    }
                }
            });
        });
    }
}
