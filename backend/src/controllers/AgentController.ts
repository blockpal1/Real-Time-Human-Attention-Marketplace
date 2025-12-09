import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { z } from 'zod';

const createBidSchema = z.object({
    target_url: z.string().optional(),
    max_price_per_second: z.number().int().positive(),
    required_attention_score: z.number().min(0).max(1),
    expiry_seconds: z.number().optional().default(60),
    quantity_seconds: z.number().int().positive().default(30), // Legacy check (keep for compatibility)
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

    // TODO: Verify Agent Balance / Auth (Mock for now)
    const agentPubkey = "mock-agent-pubkey";

    try {
        // Upsert Mock Agent
        await prisma.agent.upsert({
            where: { pubkey: agentPubkey },
            update: {},
            create: { pubkey: agentPubkey }
        });

        const bid = await prisma.bid.create({
            data: {
                agentPubkey: agentPubkey,
                targetUrl: target_url || '',
                contentUrl: content_url || null,
                maxPricePerSecond: max_price_per_second,
                requiredAttentionScore: required_attention_score,
                expiry: new Date(Date.now() + (expiry_seconds || 60) * 1000),
                targetQuantity: target_quantity,
                durationPerUser: duration_per_user,
                validationQuestion: validation_question,
                active: true,
            }
        });

        // Publish to Matcher & Monitor
        await redis.publish('marketplace_events', JSON.stringify({
            type: 'BID_CREATED',
            payload: {
                bidId: bid.id,
                max_price_per_second: max_price_per_second, // Keep as micros or normalize? Let's send raw and normalize in frontend
                price: max_price_per_second / 1_000_000, // Normalized for frontend
                target_url: target_url,
                duration: duration_per_user,
                quantity: target_quantity
            }
        }));

        res.status(201).json({ bid_id: bid.id });

    } catch (error) {
        console.error('Create Bid Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
