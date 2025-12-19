import { Request, Response } from 'express';
import { redis, redisClient } from '../utils/redis';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const startSessionSchema = z.object({
    pubkey: z.string(),
    price_floor_micros: z.number().int().positive(),
    device_attestation: z.string().optional()
});

export const startSession = async (req: Request, res: Response) => {
    const result = startSessionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const { pubkey, price_floor_micros, device_attestation } = result.data;

    try {
        // Check for existing active session by scanning user's sessions
        const existingSessionId = await redisClient.client.get(`user:${pubkey}:active_session`);

        if (existingSessionId) {
            const existingSession = await redisClient.getSession(existingSessionId) as any;
            if (existingSession && existingSession.active) {
                // Return existing session
                const secret = process.env.JWT_SECRET || 'dev-secret';
                const token = jwt.sign({ sessionId: existingSessionId, pubkey }, secret, { expiresIn: '1h' });

                console.log(`[Session] Returning existing active session for ${pubkey.slice(0, 12)}...`);
                return res.json({
                    session_token: token,
                    existing: true,
                    session_id: existingSessionId
                });
            }
        }

        // Create new session
        const sessionId = uuidv4();
        const sessionData = {
            id: sessionId,
            userPubkey: pubkey,
            priceFloor: price_floor_micros,
            deviceAttestation: device_attestation || null,
            active: true,
            connected: false,
            createdAt: Date.now()
        };

        // Store session in Redis with 1-hour TTL
        await redisClient.setSession(sessionId, sessionData, 3600);

        // Track active session for this user
        await redisClient.client.set(`user:${pubkey}:active_session`, sessionId, { EX: 3600 });

        // Add to market matching pool (sorted by price floor)
        await redisClient.addAvailableUser(sessionId, price_floor_micros);

        // Generate JWT token
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const token = jwt.sign({ sessionId, pubkey }, secret, { expiresIn: '1h' });

        // Publish ASK_CREATED event
        if (redisClient.isOpen) {
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'ASK_CREATED',
                payload: {
                    id: sessionId,
                    pricePerSecond: price_floor_micros,
                    status: 'active'
                }
            }));
        }

        console.log(`[Session] Created new session ${sessionId.slice(0, 8)}... for ${pubkey.slice(0, 12)}...`);
        res.json({ session_token: token, session_id: sessionId });

    } catch (error) {
        console.error('Start Session Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getActiveSessions = async (req: Request, res: Response) => {
    try {
        // Get all available users from the sorted set
        const sessionIds = await redisClient.client.zRange('market:available_users', 0, 99);

        const sessions: any[] = [];
        for (const sessionId of sessionIds) {
            const session = await redisClient.getSession(sessionId) as any;
            if (session && session.active) {
                sessions.push({
                    id: sessionId,
                    userPubkey: session.userPubkey,
                    priceFloor: session.priceFloor,
                    active: session.active,
                    connected: session.connected,
                    createdAt: session.createdAt
                });
            }
        }

        res.json(sessions);
    } catch (error) {
        console.error('Get Active Sessions Error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
};

/**
 * DELETE /users/session/cancel
 * Human cancels their active ask
 */
export const cancelSession = async (req: Request, res: Response) => {
    const { pubkey } = req.body;

    if (!pubkey) {
        return res.status(400).json({ error: 'Missing pubkey' });
    }

    try {
        // Find user's active session
        const sessionId = await redisClient.client.get(`user:${pubkey}:active_session`);

        if (!sessionId) {
            return res.status(404).json({ error: 'No active session found' });
        }

        const session = await redisClient.getSession(sessionId) as any;
        if (!session) {
            return res.status(404).json({ error: 'Session data not found' });
        }

        // Deactivate the session
        session.active = false;
        session.endedAt = Date.now();
        await redisClient.setSession(sessionId, session, 300); // Keep for 5 min for cleanup

        // Remove from matching pool
        await redisClient.removeAvailableUser(sessionId);

        // Clear active session tracker
        await redisClient.client.del(`user:${pubkey}:active_session`);

        // Broadcast ASK_CANCELLED event
        if (redisClient.isOpen) {
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'ASK_CANCELLED',
                payload: { id: sessionId }
            }));
        }

        console.log(`[Session] Cancelled session ${sessionId.slice(0, 8)}... for ${pubkey.slice(0, 12)}...`);
        res.json({ success: true, session_id: sessionId });

    } catch (error) {
        console.error('Cancel Session Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * PATCH /users/session/update
 * Human updates their ask price floor
 */
export const updateSession = async (req: Request, res: Response) => {
    const { pubkey, price_floor_micros } = req.body;

    if (!pubkey) {
        return res.status(400).json({ error: 'Missing pubkey' });
    }

    if (!price_floor_micros || price_floor_micros <= 0) {
        return res.status(400).json({ error: 'Invalid price_floor_micros' });
    }

    try {
        // Find user's active session
        const sessionId = await redisClient.client.get(`user:${pubkey}:active_session`);

        if (!sessionId) {
            return res.status(404).json({ error: 'No active session found' });
        }

        const session = await redisClient.getSession(sessionId) as any;
        if (!session) {
            return res.status(404).json({ error: 'Session data not found' });
        }

        // Update the price floor
        session.priceFloor = price_floor_micros;
        await redisClient.setSession(sessionId, session, 3600);

        // Update in matching pool (ZADD overwrites score)
        await redisClient.addAvailableUser(sessionId, price_floor_micros);

        // Broadcast ASK_UPDATED event
        if (redisClient.isOpen) {
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'ASK_UPDATED',
                payload: {
                    id: sessionId,
                    pricePerSecond: price_floor_micros
                }
            }));
        }

        console.log(`[Session] Updated session ${sessionId.slice(0, 8)}...: price floor now ${price_floor_micros}`);
        res.json({
            success: true,
            session_id: sessionId,
            price_floor_micros: session.priceFloor
        });

    } catch (error) {
        console.error('Update Session Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * POST /users/session/accept-highest
 * Human instantly accepts the highest current bid
 */
export const acceptHighestBid = async (req: Request, res: Response) => {
    const { pubkey, duration } = req.body;

    if (!pubkey) {
        return res.status(400).json({ error: 'Missing pubkey' });
    }

    try {
        // Use redisClient
        const { redisClient } = await import('../utils/redis');

        // ========================================
        // CHECK BOTH SOURCES: x402 + Prisma
        // ========================================

        // Source 1: x402 orders from Redis
        const x402Orders: any[] = []; // Explicit type
        if (redisClient.isOpen) {
            const openOrderIds = await redisClient.getOpenOrders();

            for (const txHash of openOrderIds) {
                const order = await redisClient.getOrder(txHash) as any;

                // Filter: Open + Quantity > 0 + Duration Match + Not Seen by User
                if (order && order.status === 'open' && order.quantity > 0) {
                    if (!duration || order.duration === duration) {
                        // Check if user has already seen this campaign
                        const hasSeen = await redisClient.hasUserSeenCampaign(txHash, pubkey);
                        if (!hasSeen) {
                            x402Orders.push({
                                source: 'x402' as const,
                                id: txHash,
                                bid: order.bid,
                                duration: order.duration,
                                content_url: order.content_url,
                                validation_question: order.validation_question,
                                order
                            });
                        }
                    }
                }
            }
        }

        // Only x402 orders as the source (Prisma removed)
        // Sort by bid price descending
        let allBids = [...x402Orders].sort((a, b) => b.bid - a.bid);

        if (allBids.length === 0) {
            return res.status(404).json({
                error: 'no_bids_available',
                message: 'No eligible bids found (you may have completed all available campaigns)'
            });
        }

        const winner = allBids[0];
        const matchedBid = winner.bid;

        // Get or create user session from Redis
        let sessionId = await redisClient.client.get(`user:${pubkey}:active_session`);
        let session = sessionId ? await redisClient.getSession(sessionId) as any : null;

        if (!session) {
            // Create session on the fly
            const { v4: uuidv4 } = await import('uuid');
            sessionId = uuidv4();
            session = {
                id: sessionId,
                userPubkey: pubkey,
                priceFloor: 0, // Accept any price
                active: true,
                connected: false,
                createdAt: Date.now()
            };
            await redisClient.setSession(sessionId, session, 3600);
            await redisClient.client.set(`user:${pubkey}:active_session`, sessionId, { EX: 3600 });
            await redisClient.addAvailableUser(sessionId, 0);
        }

        // Decrement order quantity for x402 orders
        const order = winner.order;
        order.quantity -= 1;
        order.status = order.quantity === 0 ? 'in_progress' : 'open';

        // Save to Redis
        await redisClient.setOrder(winner.id, order);
        await redisClient.updateOrderStatus(winner.id, order.status);

        // Broadcast BID_UPDATED or BID_FILLED to update frontend order book
        if (redisClient.isOpen) {
            if (order.quantity > 0) {
                await redisClient.client.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId: winner.id,
                        remainingQuantity: order.quantity
                    }
                }));
                console.log(`[Accept Highest] Broadcast BID_UPDATED: ${winner.id.slice(0, 16)}... qty=${order.quantity}`);
            } else {
                await redisClient.client.publish('marketplace_events', JSON.stringify({
                    type: 'BID_FILLED',
                    payload: { bidId: winner.id }
                }));
                console.log(`[Accept Highest] Broadcast BID_FILLED: ${winner.id.slice(0, 16)}...`);
            }
        }

        // Generate match ID
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Broadcast MATCH_FOUND to trigger the modal
        if (redisClient.isOpen) {
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'MATCH_FOUND',
                payload: {
                    matchId,
                    sessionId: session.id,
                    bidId: winner.id,
                    price: matchedBid,
                    duration: winner.duration,
                    contentUrl: winner.content_url,
                    validationQuestion: winner.validation_question
                }
            }));
        }

        console.log(`[Accept Highest] User ${pubkey.slice(0, 12)}... matched with x402 bid ${winner.id.slice(0, 16)}... @ $${matchedBid}/s`);

        // Mark user as seen for this campaign to prevent repeat matches
        await redisClient.markUserSeenCampaign(winner.id, pubkey);

        res.json({
            success: true,
            match: {
                matchId,
                bidId: winner.id,
                price: matchedBid,
                duration: winner.duration,
                contentUrl: winner.content_url,
                validationQuestion: winner.validation_question
            }
        });

    } catch (error) {
        console.error('Accept Highest Bid Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
