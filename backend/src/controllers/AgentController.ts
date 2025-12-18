import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { z } from 'zod';
import { moderationService } from '../services/ContentModerationService';

// Minimum bid floor: $0.0001/second = 100 micros
const MIN_PRICE_MICROS = 100;

const createBidSchema = z.object({
    target_url: z.string().optional(),
    max_price_per_second: z.number().int().positive(),
    required_attention_score: z.number().min(0).max(1),
    expiry_seconds: z.number().optional().default(60),
    quantity_seconds: z.number().int().positive().default(30), // Legacy (keep for compatibility)
    category: z.enum(['meme', 'doc', 'video']).default('meme'),
    content_url: z.string().optional(),

    // New Fields
    target_quantity: z.number().int().positive().default(1),
    duration_per_user: z.number().int().positive().default(10),
    validation_question: z.string().optional()
});

export const createBid = async (req: Request, res: Response) => {
    const result = createBidSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const {
        target_url,
        max_price_per_second,
        required_attention_score,
        expiry_seconds,
        content_url,
        target_quantity,
        duration_per_user,
        validation_question
    } = result.data;

    // Minimum bid floor validation
    if (max_price_per_second < MIN_PRICE_MICROS) {
        return res.status(400).json({
            error: `Bid below minimum floor price`,
            minimum_micros: MIN_PRICE_MICROS,
            minimum_usdc: MIN_PRICE_MICROS / 1_000_000,
            provided_micros: max_price_per_second
        });
    }

    // Validate duration
    if (![10, 30, 60].includes(duration_per_user)) {
        return res.status(400).json({ error: "Invalid duration. Must be 10, 30, or 60." });
    }

    // ========================================
    // ROUTE THROUGH x402 SYSTEM (UNIFIED ORDER STORE)
    // ========================================
    try {
        // Import orderStore directly
        const { orderStore } = await import('../middleware/x402OrderBook');

        // Convert price from micros to USDC
        const bid_per_second = max_price_per_second / 1_000_000;

        // Generate admin tx_hash
        const tx_hash = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const totalEscrow = duration_per_user * target_quantity * bid_per_second;

        const orderRecord = {
            duration: duration_per_user,
            quantity: target_quantity,
            bid: bid_per_second,
            total_escrow: totalEscrow,
            tx_hash,
            referrer: null,
            content_url: content_url || null,
            validation_question: validation_question || 'Did you view this content?',
            status: 'open' as const,
            created_at: Date.now(),
            result: null
        };

        // Save to x402 orderStore (unified source)
        orderStore.set(tx_hash, orderRecord);

        // Emit WebSocket event
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'BID_CREATED',
                payload: {
                    bidId: tx_hash,
                    price: bid_per_second,
                    max_price_per_second,
                    duration: duration_per_user,
                    quantity: target_quantity,
                    contentUrl: content_url || null,
                    validationQuestion: validation_question
                }
            }));
        }

        console.log(`[Campaign] Created x402 order: ${tx_hash} for ${target_quantity}x ${duration_per_user}s @ $${bid_per_second}/s`);

        return res.status(201).json({
            bid_id: tx_hash,
            tx_hash,
            mode: 'x402',
            content_status: 'approved'  // Admin bypass skips moderation
        });

    } catch (error) {
        console.error('Create Bid Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getActiveBids = async (req: Request, res: Response) => {
    try {
        const bids = await prisma.bid.findMany({
            where: {
                active: true,
                targetQuantity: { gt: 0 },
                expiry: { gt: new Date() }
            },
            take: 100,
            orderBy: { maxPricePerSecond: 'desc' }
        });
        res.json(bids);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
};
