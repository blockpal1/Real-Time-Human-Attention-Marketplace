import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

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
        // Upsert User
        await prisma.user.upsert({
            where: { pubkey },
            update: {},
            create: { pubkey }
        });

        // Check for existing active session (one ask per user)
        const existingSession = await prisma.session.findFirst({
            where: {
                userPubkey: pubkey,
                active: true
            }
        });

        if (existingSession) {
            // Return existing session instead of creating duplicate
            const secret = process.env.JWT_SECRET || 'dev-secret';
            const token = jwt.sign({ sessionId: existingSession.id, pubkey }, secret, { expiresIn: '1h' });

            console.log(`[Session] Returning existing active session for ${pubkey.slice(0, 12)}...`);
            return res.json({
                session_token: token,
                existing: true,
                session_id: existingSession.id
            });
        }

        // Create Session (only if no active session exists)
        const session = await prisma.session.create({
            data: {
                userPubkey: pubkey,
                priceFloor: price_floor_micros,
                deviceAttestation: device_attestation || null,
                active: true,
                connected: false // Will be set to true on WS connect
            }
        });

        // Generate Token
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const token = jwt.sign({ sessionId: session.id, pubkey }, secret, { expiresIn: '1h' });

        // Publish ASK_CREATED event
        if (!redis.isOpen) await redis.connect();

        const eventPayload = {
            type: 'ASK_CREATED',
            payload: {
                id: session.id, // Use session ID as Ask ID
                pricePerSecond: price_floor_micros,
                status: 'active'
            }
        };
        console.log('Publishing ASK_CREATED:', JSON.stringify(eventPayload));
        await redis.publish('marketplace_events', JSON.stringify(eventPayload));

        res.json({ session_token: token });

    } catch (error) {
        console.error('Start Session Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getActiveSessions = async (req: Request, res: Response) => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                active: true,
                matches: { none: { status: { in: ['active', 'offered'] } } } // Available only
            },
            take: 100
        });
        res.json(sessions);
    } catch (error) {
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
        // Find and deactivate user's active session
        const session = await prisma.session.findFirst({
            where: {
                userPubkey: pubkey,
                active: true
            }
        });

        if (!session) {
            return res.status(404).json({ error: 'No active session found' });
        }

        // Deactivate the session
        await prisma.session.update({
            where: { id: session.id },
            data: {
                active: false,
                endedAt: new Date()
            }
        });

        // Broadcast ASK_CANCELLED event
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'ASK_CANCELLED',
                payload: { id: session.id }
            }));
        }

        console.log(`[Session] Cancelled session ${session.id} for ${pubkey.slice(0, 12)}...`);
        res.json({ success: true, session_id: session.id });

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
        const session = await prisma.session.findFirst({
            where: {
                userPubkey: pubkey,
                active: true
            }
        });

        if (!session) {
            return res.status(404).json({ error: 'No active session found' });
        }

        // Update the price floor
        const updatedSession = await prisma.session.update({
            where: { id: session.id },
            data: { priceFloor: price_floor_micros }
        });

        // Broadcast ASK_UPDATED event
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'ASK_UPDATED',
                payload: {
                    id: session.id,
                    pricePerSecond: price_floor_micros
                }
            }));
        }

        console.log(`[Session] Updated session ${session.id}: price floor now ${price_floor_micros}`);
        res.json({
            success: true,
            session_id: session.id,
            price_floor_micros: updatedSession.priceFloor
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
        // Import orderStore dynamically
        const { orderStore } = await import('../middleware/x402OrderBook');

        // ========================================
        // CHECK BOTH SOURCES: x402 + Prisma
        // ========================================

        // Source 1: x402 orderStore
        const x402Orders = Array.from(orderStore.entries())
            .filter(([, order]) => order.status === 'open' && order.quantity > 0)
            .filter(([, order]) => !duration || order.duration === duration)
            .map(([txHash, order]) => ({
                source: 'x402' as const,
                id: txHash,
                bid: order.bid,
                duration: order.duration,
                content_url: order.content_url,
                validation_question: order.validation_question,
                order
            }));

        // Source 2: Prisma bids
        const prismaBids = await prisma.bid.findMany({
            where: {
                active: true,
                expiry: { gt: new Date() },
                targetQuantity: { gt: 0 },
                ...(duration ? { durationPerUser: duration } : {})
            },
            orderBy: { maxPricePerSecond: 'desc' },
            take: 1
        });

        const prismaOrders = prismaBids.map(bid => ({
            source: 'prisma' as const,
            id: bid.id,
            bid: bid.maxPricePerSecond / 1_000_000, // Convert to USDC
            duration: bid.durationPerUser,
            content_url: bid.contentUrl,
            validation_question: bid.validationQuestion,
            prismaBid: bid
        }));

        // Combine and find highest
        const allBids = [...x402Orders, ...prismaOrders].sort((a, b) => b.bid - a.bid);

        if (allBids.length === 0) {
            return res.status(404).json({
                error: 'no_bids_available',
                message: 'No open bids found'
            });
        }

        const winner = allBids[0];
        const matchedBid = winner.bid;

        // Get or create user session
        let session = await prisma.session.findFirst({
            where: { userPubkey: pubkey, active: true }
        });

        if (!session) {
            // Create session on the fly
            await prisma.user.upsert({
                where: { pubkey },
                update: {},
                create: { pubkey }
            });

            session = await prisma.session.create({
                data: {
                    userPubkey: pubkey,
                    priceFloor: 0, // Accept any price
                    active: true,
                    connected: false
                }
            });
        }

        // Decrement order quantity based on source
        if (winner.source === 'x402') {
            const order = winner.order;
            order.quantity -= 1;
            order.status = order.quantity === 0 ? 'in_progress' : 'open';
            orderStore.set(winner.id, order);
        } else {
            // Prisma bid - decrement quantity
            await prisma.bid.update({
                where: { id: winner.id },
                data: { targetQuantity: { decrement: 1 } }
            });
        }

        // Generate match ID
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Broadcast MATCH_FOUND to trigger the modal
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
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

        console.log(`[Accept Highest] User ${pubkey.slice(0, 12)}... matched with ${winner.source} bid ${winner.id.slice(0, 16)}... @ $${matchedBid}/s`);

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
